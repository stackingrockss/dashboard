import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_migrate import Migrate
from flask_session import Session
from datetime import datetime, date, timedelta
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport.requests import Request
from config import Config
from routes.fitness_routes import fitness_bp, update_tdee_for_date
from routes.mood_routes import mood_bp
from routes.profile_routes import profile_bp
from routes.work_routes import work_bp
from routes.food_routes import food_bp
from routes.trading_routes import trading_bp
from models import db, User, Activity, FoodEntry, TDEE, Stat, FoodReference, Workout, UserSettings, WorkColumn
from apscheduler.schedulers.background import BackgroundScheduler

# Allow HTTP for local development only
if os.environ.get('FLASK_ENV') == 'development':
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.config.from_object(Config)

# Initialize database, migrate, login manager, and session
db.init_app(app)
migrate = Migrate(app, db)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
Session(app)  # Initialize Flask-Session

# Register Blueprints
app.register_blueprint(fitness_bp, url_prefix='/fitness')
app.register_blueprint(mood_bp, url_prefix='/mood')
app.register_blueprint(profile_bp, url_prefix='/profile')
app.register_blueprint(work_bp, url_prefix='/work')
app.register_blueprint(food_bp, url_prefix='/food')
app.register_blueprint(trading_bp, url_prefix='/trading')

# Google OAuth Config
client_secrets = {
    "web": {
        "client_id": app.config['GOOGLE_CLIENT_ID'],
        "client_secret": app.config['GOOGLE_CLIENT_SECRET'],
        "redirect_uris": [app.config['GOOGLE_REDIRECT_URI']],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://accounts.google.com/o/oauth2/token"
    }
}

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    try:
        return render_template('dashboard.html')
    except Exception as e:
        return f"Error rendering template: {str(e)}", 500

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/auth/google')
def auth_google():
    try:
        # Clear any existing state to prevent conflicts
        session.pop('state', None)
        
        flow = Flow.from_client_config(
            client_secrets,
            scopes=['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
            redirect_uri=app.config['GOOGLE_REDIRECT_URI']
        )
        authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
        
        # Store state in session
        session['state'] = state
        session.permanent = True  # Make session persistent
        
        app.logger.info(f"OAuth initiated with state: {state}")
        return redirect(authorization_url)
    except Exception as e:
        app.logger.error(f"Error initiating OAuth: {str(e)}")
        return jsonify({'error': 'Failed to initiate OAuth'}), 500

@app.route('/auth/google/callback')
def auth_google_callback():
    try:
        # Log the incoming request for debugging
        app.logger.info(f"OAuth callback received: {request.url}")
        app.logger.info(f"State from session: {session.get('state')}")
        app.logger.info(f"State from request: {request.args.get('state')}")
        
        # Get state from session and request
        session_state = session.get('state')
        request_state = request.args.get('state')
        
        # Check for state mismatch
        if not session_state:
            app.logger.error("No state found in session")
            return jsonify({'error': 'OAuth session expired. Please try again.'}), 400
        
        if not request_state:
            app.logger.error("No state found in request")
            return jsonify({'error': 'Invalid OAuth response. Please try again.'}), 400
        
        if session_state != request_state:
            app.logger.error(f"State mismatch: session={session_state}, request={request_state}")
            # Clear the invalid state and redirect to login
            session.pop('state', None)
            return jsonify({'error': 'OAuth state mismatch. Please try logging in again.'}), 400
        
        # Create flow with the validated state
        flow = Flow.from_client_config(
            client_secrets,
            scopes=['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
            state=session_state,
            redirect_uri=app.config['GOOGLE_REDIRECT_URI']
        )
        
        app.logger.info(f"Fetching token with redirect URI: {app.config['GOOGLE_REDIRECT_URI']}")
        flow.fetch_token(authorization_response=request.url)
        credentials = flow.credentials
        id_info = id_token.verify_oauth2_token(credentials.id_token, Request(), app.config['GOOGLE_CLIENT_ID'])
        google_id = id_info['sub']
        email = id_info['email']
        full_name = id_info.get('name', '')
        
        # Split the full name into first and last name
        name_parts = full_name.split(' ', 1) if full_name else ['', '']
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User(google_id=google_id, email=email, first_name=first_name, last_name=last_name)
            db.session.add(user)
            db.session.commit()
        
        # Clear the OAuth state after successful login
        session.pop('state', None)
        login_user(user)
        
        app.logger.info(f"Successfully logged in user: {email}")
        return redirect(url_for('index'))
        
    except Exception as e:
        app.logger.error(f"OAuth callback error: {str(e)}")
        app.logger.error(f"Error type: {type(e).__name__}")
        # Clear any invalid state
        session.pop('state', None)
        return jsonify({'error': f'OAuth error: {str(e)}'}), 400

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/check_auth')
@login_required
def check_auth():
    return jsonify({'message': 'Authenticated'})

@app.route('/api/tdee', methods=['GET'])
@login_required
def get_tdee():
    try:
        date_str = request.args.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        tdee = TDEE.query.filter_by(user_id=current_user.id, date=date).first()
        
        # Get activity level from TDEE record if available, otherwise from activities
        activity_level = 'light'  # default to light
        if tdee and tdee.activity_level:
            # Use the activity level from the TDEE record (this is the manually set one)
            activity_level = tdee.activity_level
        else:
            # Fall back to activity level from activities
            activities = Activity.query.filter_by(user_id=current_user.id, date=date).all()
            if activities:
                # Use the activity level from the first activity (they should all be the same for a given date)
                first_activity = activities[0]
                if first_activity.activity_level:
                    activity_level = first_activity.activity_level
        
        # Activity level display names
        activity_level_names = {
            'sedentary': 'Sedentary',
            'light': 'Lightly Active',
            'moderate': 'Moderately Active',
            'active': 'Very Active',
            'very_active': 'Extremely Active'
        }
        
        # Activity level multipliers for reference
        activity_multipliers = {
            'sedentary': 1.2,
            'light': 1.375,
            'moderate': 1.55,
            'active': 1.725,
            'very_active': 1.9
        }
        
        if tdee:
            balance = tdee.calorie_intake - tdee.tdee if tdee.calorie_intake is not None else None
            status = None
            if balance is not None:
                if balance < -100:
                    status = 'Deficit'
                elif balance > 100:
                    status = 'Surplus'
                else:
                    status = 'Maintenance'
            
            # Determine calorie source
            food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=date).all()
            logged_food_entries = [e for e in food_entries if e.food_name != 'Manual Entry']
            manual_entries = [e for e in food_entries if e.food_name == 'Manual Entry']
            
            if logged_food_entries:
                calorie_source = 'Logged Food'
                calorie_source_detail = f"{len(logged_food_entries)} logged food entries"
            elif manual_entries:
                calorie_source = 'Manual Input'
                calorie_source_detail = "Manual calorie entry"
            else:
                calorie_source = 'None'
                calorie_source_detail = "No food data"
            
            # Calculate base TDEE (without workout activities) for reference
            base_tdee = tdee.bmr * activity_multipliers.get(activity_level, 1.375)
            
            return jsonify({
                'date': tdee.date.strftime('%Y-%m-%d'),
                'bmr': tdee.bmr,
                'activity_level': activity_level,
                'activity_level_name': activity_level_names.get(activity_level, 'Lightly Active'),
                'activity_multiplier': activity_multipliers.get(activity_level, 1.375),
                'base_tdee': round(base_tdee),  # TDEE from activity level only
                'activity_calories': tdee.activity_calories,
                'tdee': tdee.tdee,
                'calorie_intake': tdee.calorie_intake,
                'calorie_source': calorie_source,
                'calorie_source_detail': calorie_source_detail,
                'balance': balance,
                'status': status
            })
        else:
            # Check if user has profile data (either in user profile or recent stats)
            user = User.query.get(current_user.id)
            
            # Check for most recent stat entry
            recent_stat = Stat.query.filter_by(user_id=current_user.id).order_by(Stat.date.desc()).first()
            
            # Check if we have complete profile data from either source
            has_profile = False
            if recent_stat and all([recent_stat.weight, recent_stat.height, recent_stat.age, recent_stat.sex]):
                has_profile = True
            elif user and all([user.weight, user.height, user.age, user.sex]):
                has_profile = True
            
            # Check for food entries
            food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=date).all()
            logged_food_entries = [e for e in food_entries if e.food_name != 'Manual Entry']
            manual_entries = [e for e in food_entries if e.food_name == 'Manual Entry']
            
            if logged_food_entries:
                calorie_source = 'Logged Food'
                calorie_source_detail = f"{len(logged_food_entries)} logged food entries"
                calorie_intake = sum(e.calories for e in logged_food_entries if e.calories)
            elif manual_entries:
                calorie_source = 'Manual Input'
                calorie_source_detail = "Manual calorie entry"
                calorie_intake = sum(e.calories for e in manual_entries if e.calories)
            else:
                calorie_source = 'None'
                calorie_source_detail = "No food data"
                calorie_intake = 0
            
            # Check for activities
            activity_calories = sum(a.calories_burned for a in activities if a.calories_burned)
            
            if not has_profile:
                return jsonify({
                    'date': date_str,
                    'error': 'Profile incomplete',
                    'message': 'Please complete your profile (weight, height, age, sex) to calculate TDEE',
                    'activity_level': activity_level,
                    'activity_level_name': activity_level_names.get(activity_level, 'Lightly Active'),
                    'calorie_intake': calorie_intake,
                    'calorie_source': calorie_source,
                    'calorie_source_detail': calorie_source_detail,
                    'activity_calories': activity_calories,
                    'bmr': None,
                    'tdee': None,
                    'balance': None,
                    'status': 'Profile Required'
                }), 200  # Return 200 instead of 404 to show the message
            
            # If profile exists but no TDEE record, try to create one
            from routes.fitness_routes import update_tdee_for_date
            tdee = update_tdee_for_date(current_user.id, date)
            
            if tdee:
                # Recursively call this function to get the newly created TDEE data
                return get_tdee()
            else:
                # Check if we have BMR from latest stat but couldn't create TDEE
                recent_stat = Stat.query.filter_by(user_id=current_user.id).order_by(Stat.date.desc()).first()
                if recent_stat and recent_stat.bmr:
                    base_tdee = recent_stat.bmr * activity_multipliers.get(activity_level, 1.375)
                    return jsonify({
                        'date': date_str,
                        'error': 'Unable to calculate TDEE',
                        'message': f'BMR from latest scan ({recent_stat.date}): {recent_stat.bmr} kcal. Unable to calculate TDEE for this date.',
                        'activity_level': activity_level,
                        'activity_level_name': activity_level_names.get(activity_level, 'Lightly Active'),
                        'activity_multiplier': activity_multipliers.get(activity_level, 1.375),
                        'base_tdee': round(base_tdee),
                        'calorie_intake': calorie_intake,
                        'calorie_source': calorie_source,
                        'calorie_source_detail': calorie_source_detail,
                        'activity_calories': activity_calories,
                        'bmr': recent_stat.bmr,
                        'tdee': None,
                        'balance': None,
                        'status': 'Calculation Error'
                    }), 200
                else:
                    return jsonify({
                        'date': date_str,
                        'error': 'Unable to calculate TDEE',
                        'message': 'Unable to calculate TDEE for this date',
                        'activity_level': activity_level,
                        'activity_level_name': activity_level_names.get(activity_level, 'Lightly Active'),
                        'calorie_intake': calorie_intake,
                        'calorie_source': calorie_source,
                        'calorie_source_detail': calorie_source_detail,
                        'activity_calories': activity_calories,
                        'bmr': None,
                        'tdee': None,
                        'balance': None,
                        'status': 'Calculation Error'
                    }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tdee_history', methods=['GET'])
@login_required
def get_tdee_history():
    try:
        tdees = TDEE.query.filter_by(user_id=current_user.id).order_by(TDEE.date.desc()).all()
        print(f"Found {len(tdees)} TDEE records for user {current_user.id}")
        for t in tdees:
            print(f"  TDEE ID: {t.id}, Date: {t.date}, TDEE: {t.tdee}")
        
        # Activity level multipliers
        activity_multipliers = {
            'sedentary': 1.2,
            'light': 1.375,
            'moderate': 1.55,
            'active': 1.725,
            'very_active': 1.9
        }
        
        result = []
        for t in tdees:
            # Get activity level for this specific date
            activities = Activity.query.filter_by(user_id=current_user.id, date=t.date).all()
            activity_level = 'light'  # default to light
            if activities:
                first_activity = activities[0]
                if first_activity.activity_level:
                    activity_level = first_activity.activity_level
            
            result.append({
                'id': t.id,
                'date': t.date.strftime('%Y-%m-%d'),
                'bmr': t.bmr,
                'base_tdee': round(t.bmr * activity_multipliers.get(activity_level, 1.375)) if t.bmr else None,
                'activity_calories': t.activity_calories,
                'tdee': t.tdee,
                'calorie_intake': t.calorie_intake,
                'balance': t.calorie_intake - t.tdee if t.calorie_intake is not None else None,
                'status': 'Deficit' if t.calorie_intake and (t.calorie_intake - t.tdee < -100) else
                         'Surplus' if t.calorie_intake and (t.calorie_intake - t.tdee > 100) else
                         'Maintenance' if t.calorie_intake else None
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    try:
        data = request.form
        current_user.weight = float(data.get('weight')) if data.get('weight') else current_user.weight
        current_user.height = float(data.get('height')) if data.get('height') else current_user.height
        current_user.age = int(data.get('age')) if data.get('age') else current_user.age
        current_user.sex = data.get('sex') if data.get('sex') else current_user.sex
        db.session.commit()
        
        # Update TDEE for all dates with new profile data
        from routes.fitness_routes import update_all_tdee_records
        update_all_tdee_records(current_user.id)
        
        return jsonify({'message': 'Profile updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tdee_calculate', methods=['GET'])
@login_required
def calculate_tdee():
    """Calculate TDEE for a date without saving to database (for real-time preview)."""
    try:
        date_str = request.args.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        activity_level = request.args.get('activity_level', 'light')  # Get activity level from request
        
        # Calculate TDEE without saving to database
        from routes.fitness_routes import calculate_tdee_for_date
        tdee_data = calculate_tdee_for_date(current_user.id, date, save_to_db=False, activity_level=activity_level)
        
        if not tdee_data:
            return jsonify({'error': 'Unable to calculate TDEE'}), 400
        
        # Activity level display names
        activity_level_names = {
            'sedentary': 'Sedentary',
            'light': 'Lightly Active',
            'moderate': 'Moderately Active',
            'active': 'Very Active',
            'very_active': 'Extremely Active'
        }
        
        # Calculate balance and status
        balance = tdee_data['calorie_intake'] - tdee_data['tdee'] if tdee_data['calorie_intake'] is not None else None
        status = None
        if balance is not None:
            if balance < -100:
                status = 'Deficit'
            elif balance > 100:
                status = 'Surplus'
            else:
                status = 'Maintenance'
        
        return jsonify({
            'date': date.strftime('%Y-%m-%d'),
            'bmr': tdee_data['bmr'],
            'activity_level': tdee_data['activity_level'],
            'activity_level_name': activity_level_names.get(tdee_data['activity_level'], 'Lightly Active'),
            'activity_multiplier': tdee_data['activity_multiplier'],
            'base_tdee': tdee_data['base_tdee'],
            'activity_calories': tdee_data['activity_calories'],
            'tdee': tdee_data['tdee'],
            'calorie_intake': tdee_data['calorie_intake'],
            'balance': balance,
            'status': status
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tdee_save', methods=['POST'])
@login_required
def save_daily_tdee():
    """Save the final TDEE for a date to the database."""
    try:
        data = request.get_json()
        date_str = data.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Save TDEE to database
        from routes.fitness_routes import update_tdee_for_date
        tdee = update_tdee_for_date(current_user.id, date)
        
        if not tdee:
            return jsonify({'error': 'Unable to save TDEE'}), 400
        
        return jsonify({
            'message': 'Daily TDEE saved successfully',
            'date': date.strftime('%Y-%m-%d'),
            'tdee': tdee.tdee
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def record_daily_tdees():
    """Job to automatically record TDEE for all users for the previous day."""
    with app.app_context():
        yesterday = date.today() - timedelta(days=1)
        users = User.query.all()
        app.logger.info(f"Starting daily TDEE recording job for {len(users)} users for date: {yesterday}")
        for user in users:
            try:
                app.logger.info(f"Recording TDEE for user {user.id}...")
                update_tdee_for_date(user.id, yesterday)
                app.logger.info(f"Successfully recorded TDEE for user {user.id}.")
            except Exception as e:
                app.logger.error(f"Error recording TDEE for user {user.id}: {e}")
        app.logger.info("Finished daily TDEE recording job.")

def populate_default_work_columns():
    try:
        default_columns = [
            ('Q2', 0),
            ('Q3', 1),
            ('Q4', 2),
            ('Q5', 3),
            ('Strategic Opps', 4)
        ]
        if WorkColumn.query.count() == 0:
            for title, order in default_columns:
                db.session.add(WorkColumn(title=title, order=order))
            db.session.commit()
    except Exception as e:
        print(f"Warning: Could not populate work columns: {e}")
        # This is expected when the database is being initialized
        pass

# APScheduler integration for repeat activities
# Commented out due to circular import issues
# try:
#     from apscheduler.schedulers.background import BackgroundScheduler
#     from scripts.auto_log_repeat_activities import auto_log_for_all_users
#     import os
#     if os.environ.get('WERKZEUG_RUN_MAIN', 'true') == 'true':  # Only start in main process
#         scheduler = BackgroundScheduler()
#         scheduler.add_job(func=auto_log_for_all_users, trigger="cron", hour=0, minute=5)
#         scheduler.start()
# except Exception as e:
#     print(f"[APScheduler] Scheduler not started: {e}")

if __name__ == '__main__':
    # Start the scheduler only in the main process
    if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        scheduler = BackgroundScheduler()
        scheduler.add_job(func=record_daily_tdees, trigger="cron", hour=2, minute=30)
        scheduler.start()
        app.logger.info("Scheduler started for daily TDEE recording.")
        
        # Shut down the scheduler when exiting the app
        import atexit
        atexit.register(lambda: scheduler.shutdown())

    with app.app_context():
        populate_default_work_columns()
    app.run(debug=True, use_reloader=True, host='0.0.0.0', port=5000)