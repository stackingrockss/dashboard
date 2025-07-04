from flask import Blueprint, request, jsonify, current_app, render_template
from flask_login import login_required, current_user
from models import db, User, Stat, FoodReference, FoodEntry, Workout, Activity, TDEE, UserSettings, ExerciseCategory, Exercise, UserFavoriteExercise, ProgressPic, PersonalRecord, FastingPeriod, DistanceMilestone, UserExercise, WorkoutTemplate, WorkoutTemplateExercise, WorkoutSession, WorkoutSessionExercise
from utils import clean_nutrient_value, convert_units
from datetime import datetime, timedelta
import traceback
import os
from werkzeug.utils import secure_filename
from ocr_processor import ocr_processor
from sqlalchemy import func, distinct

fitness_bp = Blueprint('fitness', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def calculate_tdee_for_date(user_id, date, save_to_db=False, activity_level=None):
    """Calculate TDEE for a given date, optionally saving to database."""
    try:
        user = User.query.get(user_id)
        
        # Get the most recent stat entry for this user on or before the given date
        stat = Stat.query.filter(Stat.user_id == user_id, Stat.date <= date, Stat.bmr != None).order_by(Stat.date.desc()).first()
        
        # Use stat data if available, otherwise fall back to user profile data
        weight = stat.weight if stat and stat.weight else (user.weight if user else None)
        height = stat.height if stat and stat.height else (user.height if user else None)
        age = stat.age if stat and stat.age else (user.age if user else None)
        sex = stat.sex if stat and stat.sex else (user.sex if user else None)
        
        # Use BMR from latest bodyscan if available, otherwise calculate it
        user_settings = UserSettings.query.filter_by(user_id=user_id).first()
        units = user_settings.units if user_settings and user_settings.units else 'imperial'
        if stat:
            bmr = stat.bmr
        elif weight is not None and height is not None and age is not None and sex is not None:
            print(f"[BMR DEBUG] Using profile values: weight={weight}, height={height}, age={age}, sex={sex}, units={units}")
            if units == 'imperial':
                # Use imperial formula
                if str(sex).lower() == 'male':
                    bmr = 4.536 * weight + 15.88 * height - 5 * age + 5
                else:
                    bmr = 4.536 * weight + 15.88 * height - 5 * age - 161
                print(f"[BMR DEBUG] Calculated BMR (imperial): {bmr}")
            else:
                # Use metric formula
                weight_kg = weight / 2.20462
                height_cm = height * 2.54
                if str(sex).lower() == 'male':
                    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
                else:
                    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
                print(f"[BMR DEBUG] Calculated BMR (metric): {bmr}")
        else:
            return None  # Skip if profile incomplete and no BMR available

        # Get activities for the date to determine workout calories
        activities = Activity.query.filter_by(user_id=user_id, date=date).order_by(Activity.id.desc()).all()
        activity_calories = sum(a.calories_burned for a in activities if a.calories_burned)
        
        # Determine the daily activity level with a clear priority
        if activity_level:
            daily_activity_level = activity_level
        else:
            # Find the most recently added activity for the day that has an activity level
            latest_activity_with_level = next((a.activity_level for a in activities if a.activity_level), None)
            if latest_activity_with_level:
                daily_activity_level = latest_activity_with_level
            else:
                # Fallback to user's general setting if no daily level is set
                user_settings = UserSettings.query.filter_by(user_id=user_id).first()
                if user_settings and user_settings.activity_level:
                    daily_activity_level = user_settings.activity_level
                else:
                    daily_activity_level = 'light'  # Default if no setting is found

        # Activity level multipliers
        activity_multipliers = {
            'sedentary': 1.2,
            'light': 1.375,
            'moderate': 1.55,
            'active': 1.725,
            'very_active': 1.9
        }
        
        # Calculate base TDEE with activity level multiplier
        activity_multiplier = activity_multipliers.get(daily_activity_level, 1.375)  # default to light multiplier
        base_tdee = bmr * activity_multiplier

        # Get all food entries for the date
        food_entries = FoodEntry.query.filter_by(user_id=user_id, date=date).all()
        
        # Implement priority system: logged food takes priority over manual input
        logged_food_entries = [e for e in food_entries if e.food_name != 'Manual Entry']
        manual_entries = [e for e in food_entries if e.food_name == 'Manual Entry']
        
        if logged_food_entries:
            # If logged food exists, use only logged food calories
            calorie_intake = sum(e.calories for e in logged_food_entries if e.calories)
        elif manual_entries:
            # If no logged food but manual entries exist, use manual input
            calorie_intake = sum(e.calories for e in manual_entries if e.calories)
        else:
            # No food entries at all
            calorie_intake = 0

        # Final TDEE = base TDEE (with activity level) + additional workout calories
        tdee_value = base_tdee + activity_calories

        # Create TDEE object with calculated values
        tdee_data = {
            'user_id': user_id,
            'date': date,
            'bmr': round(bmr),
            'activity_calories': activity_calories,
            'tdee': round(tdee_value),
            'calorie_intake': calorie_intake,
            'activity_level': daily_activity_level,
            'activity_multiplier': activity_multiplier,
            'base_tdee': round(base_tdee)
        }

        # Save to database only if requested
        if save_to_db:
            tdee = TDEE.query.filter_by(user_id=user_id, date=date).first()
            # Preserve manually set activity_level if not provided
            if not activity_level and tdee and tdee.activity_level:
                activity_level = tdee.activity_level
            # Only update if activity_level is not None
            if activity_level is not None:
                daily_activity_level = activity_level
                activity_multiplier = activity_multipliers.get(daily_activity_level, 1.375)
                base_tdee = bmr * activity_multiplier
                tdee_data['activity_level'] = daily_activity_level
                tdee_data['activity_multiplier'] = activity_multiplier
                tdee_data['base_tdee'] = round(base_tdee)
                tdee_data['tdee'] = round(base_tdee + activity_calories)
            # The following fields are valid for the TDEE model; linter errors are false positives
            if tdee:
                tdee.bmr = tdee_data['bmr']
                tdee.activity_calories = tdee_data['activity_calories']
                tdee.tdee = tdee_data['tdee']
                tdee.calorie_intake = tdee_data['calorie_intake']
                tdee.activity_level = tdee_data['activity_level']
                tdee.activity_multiplier = tdee_data['activity_multiplier']
                tdee.base_tdee = tdee_data['base_tdee']
            else:
                tdee = TDEE(
                    user_id=user_id,
                    date=date,
                    bmr=tdee_data['bmr'],
                    activity_calories=tdee_data['activity_calories'],
                    tdee=tdee_data['tdee'],
                    calorie_intake=tdee_data['calorie_intake'],
                    activity_level=tdee_data['activity_level'],
                    activity_multiplier=tdee_data['activity_multiplier'],
                    base_tdee=tdee_data['base_tdee']
                )
                db.session.add(tdee)
            db.session.commit()
            return tdee
        else:
            return tdee_data
            
    except Exception as e:
        if save_to_db:
            db.session.rollback()
        print(f"Error calculating TDEE: {str(e)}")
        return None

def update_tdee_for_date(user_id, date, activity_level=None):
    """Update or create TDEE record for a given date."""
    return calculate_tdee_for_date(user_id, date, save_to_db=True, activity_level=activity_level)

def update_all_tdee_records(user_id):
    """Update TDEE records for all dates when profile data changes."""
    try:
        # Get all unique dates that have activities, food entries, or existing TDEE records
        activity_dates = db.session.query(Activity.date).filter_by(user_id=user_id).distinct().all()
        food_dates = db.session.query(FoodEntry.date).filter_by(user_id=user_id).distinct().all()
        tdee_dates = db.session.query(TDEE.date).filter_by(user_id=user_id).distinct().all()
        
        # Combine all dates
        all_dates = set()
        for (date,) in activity_dates:
            all_dates.add(date)
        for (date,) in food_dates:
            all_dates.add(date)
        for (date,) in tdee_dates:
            all_dates.add(date)
        
        for date in all_dates:
            update_tdee_for_date(user_id, date, activity_level=None)
        return True
    except Exception as e:
        print(f"Error updating all TDEE records: {str(e)}")
        return False

@fitness_bp.route('/add_stat', methods=['POST'])
@login_required
def add_stat():
    try:
        current_date = datetime.now().date()
        data = request.form
        
        bodyscan_image_path = None
        ocr_metrics = {}
        
        if 'bodyscan_image' in request.files:
            file = request.files['bodyscan_image']
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                # Ensure unique filenames
                unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
                upload_folder = current_app.config['UPLOAD_FOLDER']
                
                # Check if upload_folder is an absolute path, if not, make it so
                if not os.path.isabs(upload_folder):
                    upload_folder = os.path.join(current_app.root_path, upload_folder)
                
                if not os.path.exists(upload_folder):
                    os.makedirs(upload_folder)

                file_path = os.path.join(upload_folder, unique_filename)
                file.save(file_path)
                # Store relative path for web access
                bodyscan_image_path = os.path.join('static/uploads', unique_filename).replace('\\', '/')
                
                # Process OCR if image was uploaded
                try:
                    ocr_metrics = ocr_processor.process_inbody_image(file_path)
                except Exception as e:
                    current_app.logger.error(f"OCR processing failed: {e}")
                    ocr_metrics = {}

        # Use OCR data if available, otherwise use form data
        stat_fields = {
            'weight': clean_nutrient_value(data.get('weight')) or ocr_metrics.get('weight'),
            'body_fat_percentage': clean_nutrient_value(data.get('body_fat_percentage')) or ocr_metrics.get('body_fat_percentage'),
            'resting_heart_rate': int(data.get('resting_heart_rate')) if data.get('resting_heart_rate') else None,
            'smm': clean_nutrient_value(data.get('smm')) or ocr_metrics.get('smm'),
            'body_fat_mass': clean_nutrient_value(data.get('body_fat_mass')) or ocr_metrics.get('body_fat_mass'),
            'lean_body_mass': clean_nutrient_value(data.get('lean_body_mass')) or ocr_metrics.get('lean_body_mass'),
            'bmr': int(data.get('bmr')) if data.get('bmr') else ocr_metrics.get('bmr'),
            'bicep_measurement': clean_nutrient_value(data.get('bicep_measurement')) or ocr_metrics.get('bicep_measurement'),
            'chest_measurement': clean_nutrient_value(data.get('chest_measurement')) or ocr_metrics.get('chest_measurement'),
            'waist_measurement': clean_nutrient_value(data.get('waist_measurement')) or ocr_metrics.get('waist_measurement'),
            'butt_measurement': clean_nutrient_value(data.get('butt_measurement')) or ocr_metrics.get('butt_measurement'),
            'quad_measurement': clean_nutrient_value(data.get('quad_measurement')) or ocr_metrics.get('quad_measurement'),
            'left_arm_lean_mass': clean_nutrient_value(data.get('left_arm_lean_mass')) or ocr_metrics.get('left_arm_lean_mass'),
            'right_arm_lean_mass': clean_nutrient_value(data.get('right_arm_lean_mass')) or ocr_metrics.get('right_arm_lean_mass'),
            'left_leg_lean_mass': clean_nutrient_value(data.get('left_leg_lean_mass')) or ocr_metrics.get('left_leg_lean_mass'),
            'right_leg_lean_mass': clean_nutrient_value(data.get('right_leg_lean_mass')) or ocr_metrics.get('right_leg_lean_mass'),
            'trunk_lean_mass': clean_nutrient_value(data.get('trunk_lean_mass')) or ocr_metrics.get('trunk_lean_mass'),
            'bodyscan_image_path': bodyscan_image_path
        }
        # Only keep fields that are valid for the Stat model
        valid_stat_fields = [
            'weight', 'body_fat_percentage', 'resting_heart_rate', 'smm', 'body_fat_mass',
            'lean_body_mass', 'bmr', 'bicep_measurement', 'chest_measurement',
            'waist_measurement', 'butt_measurement', 'quad_measurement',
            'left_arm_lean_mass', 'right_arm_lean_mass', 'left_leg_lean_mass',
            'right_leg_lean_mass', 'trunk_lean_mass', 'bodyscan_image_path'
        ]
        filtered_stat_fields = {k: v for k, v in stat_fields.items() if k in valid_stat_fields}
        has_data = any(v not in [None, '', 0] for k, v in filtered_stat_fields.items() if k != 'bodyscan_image_path')
        if not has_data:
            return jsonify({'error': 'No stat fields provided. Please enter at least one value.'}), 400
        # user_id and date are valid fields for Stat (see models.py), linter errors are false positives
        stat = Stat(user_id=current_user.id, date=current_date, **filtered_stat_fields)
        db.session.add(stat)
        db.session.commit()
        
        update_all_tdee_records(current_user.id)
        
        response_data = {'message': 'Stat added successfully'}
        if ocr_metrics:
            response_data['ocr_metrics'] = ocr_metrics
            response_data['message'] += f' (OCR extracted {len(ocr_metrics)} metrics)'
        
        return jsonify(response_data)
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/process_ocr', methods=['POST'])
@login_required
def process_ocr():
    """Process OCR on uploaded image without saving to database"""
    try:
        if 'bodyscan_image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['bodyscan_image']
        if not file or not file.filename or not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        unique_filename = f"temp_{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        upload_folder = current_app.config['UPLOAD_FOLDER']
        
        if not os.path.isabs(upload_folder):
            upload_folder = os.path.join(current_app.root_path, upload_folder)
        
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)

        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # Process OCR
        try:
            ocr_metrics = ocr_processor.process_inbody_image(file_path)
        except Exception as e:
            current_app.logger.error(f"OCR processing failed: {e}")
            ocr_metrics = {}
        
        # Store relative path for web access
        image_path = os.path.join('static/uploads', unique_filename).replace('\\', '/')
        
        return jsonify({
            'success': True,
            'message': f'OCR extracted {len(ocr_metrics)} metrics',
            'metrics': ocr_metrics,
            'image_path': image_path,
            'temp_filename': unique_filename
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in process_ocr: {e}")
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/review_ocr', methods=['GET'])
@login_required
def review_ocr():
    """Show OCR review page"""
    return render_template('review_ocr.html')

@fitness_bp.route('/save_reviewed_stat', methods=['POST'])
@login_required
def save_reviewed_stat():
    """Save stat after OCR review"""
    try:
        current_date = datetime.now().date()
        data = request.form
        
        # Get the temp image path and move it to permanent location
        temp_filename = data.get('temp_filename')
        bodyscan_image_path = None
        
        if temp_filename:
            temp_path = os.path.join(current_app.config['UPLOAD_FOLDER'], temp_filename)
            if os.path.exists(temp_path):
                # Move to permanent location
                permanent_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{temp_filename.replace('temp_', '')}"
                permanent_path = os.path.join(current_app.config['UPLOAD_FOLDER'], permanent_filename)
                os.rename(temp_path, permanent_path)
                bodyscan_image_path = os.path.join('static/uploads', permanent_filename).replace('\\', '/')
        
        # Create stat with reviewed data
        stat = Stat(
            user_id=current_user.id,
            date=current_date,
            weight=clean_nutrient_value(data.get('weight')),
            body_fat_percentage=clean_nutrient_value(data.get('body_fat_percentage')),
            resting_heart_rate=int(data.get('resting_heart_rate')) if data.get('resting_heart_rate') else None,
            smm=clean_nutrient_value(data.get('smm')),
            body_fat_mass=clean_nutrient_value(data.get('body_fat_mass')),
            lean_body_mass=clean_nutrient_value(data.get('lean_body_mass')),
            bmr=int(data.get('bmr')) if data.get('bmr') else None,
            bicep_measurement=clean_nutrient_value(data.get('bicep_measurement')),
            chest_measurement=clean_nutrient_value(data.get('chest_measurement')),
            waist_measurement=clean_nutrient_value(data.get('waist_measurement')),
            butt_measurement=clean_nutrient_value(data.get('butt_measurement')),
            quad_measurement=clean_nutrient_value(data.get('quad_measurement')),
            left_arm_lean_mass=clean_nutrient_value(data.get('left_arm_lean_mass')),
            right_arm_lean_mass=clean_nutrient_value(data.get('right_arm_lean_mass')),
            left_leg_lean_mass=clean_nutrient_value(data.get('left_leg_lean_mass')),
            right_leg_lean_mass=clean_nutrient_value(data.get('right_leg_lean_mass')),
            trunk_lean_mass=clean_nutrient_value(data.get('trunk_lean_mass')),
            bodyscan_image_path=bodyscan_image_path
        )
        db.session.add(stat)
        db.session.commit()
        
        update_all_tdee_records(current_user.id)
        
        return jsonify({'message': 'Stat saved successfully'})
        
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/data', methods=['GET'])
@login_required
def get_stats():
    try:
        if not current_user.is_authenticated:
            return jsonify({"error": "User not authenticated"}), 401
        stats = Stat.query.filter_by(user_id=current_user.id).all()
        stats_data = []
        for stat in stats:
            try:
                stat_dict = {
                    'id': stat.id,
                    'date': stat.date.strftime('%Y-%m-%d') if stat.date else None,
                    'weight': float(stat.weight) if stat.weight is not None else None,
                    'bodyscan_image_path': stat.bodyscan_image_path,
                    'body_fat_percentage': float(stat.body_fat_percentage) if stat.body_fat_percentage is not None else None,
                    'resting_heart_rate': int(stat.resting_heart_rate) if stat.resting_heart_rate is not None else None,
                    'smm': float(stat.smm) if stat.smm is not None else None,
                    'body_fat_mass': float(stat.body_fat_mass) if stat.body_fat_mass is not None else None,
                    'lean_body_mass': float(stat.lean_body_mass) if stat.lean_body_mass is not None else None,
                    'bmr': int(stat.bmr) if stat.bmr is not None else None,
                    'bicep_measurement': float(stat.bicep_measurement) if stat.bicep_measurement is not None else None,
                    'chest_measurement': float(stat.chest_measurement) if stat.chest_measurement is not None else None,
                    'waist_measurement': float(stat.waist_measurement) if stat.waist_measurement is not None else None,
                    'butt_measurement': float(stat.butt_measurement) if stat.butt_measurement is not None else None,
                    'quad_measurement': float(stat.quad_measurement) if stat.quad_measurement is not None else None,
                    'left_arm_lean_mass': float(stat.left_arm_lean_mass) if stat.left_arm_lean_mass is not None else None,
                    'right_arm_lean_mass': float(stat.right_arm_lean_mass) if stat.right_arm_lean_mass is not None else None,
                    'left_leg_lean_mass': float(stat.left_leg_lean_mass) if stat.left_leg_lean_mass is not None else None,
                    'right_leg_lean_mass': float(stat.right_leg_lean_mass) if stat.right_leg_lean_mass is not None else None,
                    'trunk_lean_mass': float(stat.trunk_lean_mass) if stat.trunk_lean_mass is not None else None
                }
                stats_data.append(stat_dict)
            except AttributeError as e:
                print(f"get_stats: Error processing stat ID {stat.id}: {e}")
                continue
        print(f"get_stats: Returning {len(stats_data)} stats")
        return jsonify(stats_data)
    except Exception as e:
        print(f"get_stats: Unexpected error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@fitness_bp.route('/add_food_entry', methods=['POST'])
@login_required
def add_food_entry():
    try:
        data = request.form
        date = datetime.strptime(data.get('food_date'), '%Y-%m-%d').date()
        food_name = data.get('food_name')
        quantity = float(data.get('quantity'))
        unit = data.get('unit')
        food_ref = FoodReference.query.filter_by(food_name=food_name).first()
        if not food_ref:
            return jsonify({'error': 'Food not found in reference database'}), 400
        entry = FoodEntry(
            user_id=current_user.id,
            date=date,
            food_name=food_name,
            calories=int(food_ref.calories * convert_units(quantity, unit, 'serving')),
            protein=clean_nutrient_value(food_ref.protein * convert_units(quantity, unit, 'serving')),
            carbs=clean_nutrient_value(food_ref.carbs * convert_units(quantity, unit, 'serving')),
            fat=clean_nutrient_value(food_ref.fat * convert_units(quantity, unit, 'serving')),
            quantity=quantity,
            unit=unit
        )
        db.session.add(entry)
        db.session.commit()
        update_tdee_for_date(current_user.id, date)
        return jsonify({'message': 'Food entry added successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/food_entries')
@login_required
def get_food_entries():
    try:
        entries = FoodEntry.query.filter_by(user_id=current_user.id).order_by(FoodEntry.date.desc()).all()
        return jsonify([{
            'id': e.id,
            'date': e.date.strftime('%Y-%m-%d'),
            'food_name': e.food_name,
            'calories': e.calories,
            'protein': e.protein,
            'carbs': e.carbs,
            'fat': e.fat,
            'quantity': e.quantity,
            'unit': e.unit
        } for e in entries])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/add_workout', methods=['POST'])
@login_required
def add_workout():
    try:
        data = request.form
        exercise_name = data.get('exercise')
        weight = float(data.get('weight') or 0)
        reps = int(data.get('reps') or 0)
        sets = int(data.get('sets') or 1)
        date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()
        
        # Check current PRs before adding the workout
        current_weight_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=exercise_name, 
            pr_type='weight'
        ).first()
        current_reps_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=exercise_name, 
            pr_type='reps'
        ).first()
        
        workout = Workout(
            user_id=current_user.id,
            date=date,
            exercise=exercise_name,
            category=data.get('category'),
            weight=weight,
            reps=reps,
            sets=sets
        )
        db.session.add(workout)
        db.session.commit()
        
        # Update PRs
        update_prs_for_workout(current_user.id, exercise_name, weight, reps, sets, workout.id, date)
        
        # Check which PRs were newly achieved
        new_prs = []
        if (not current_weight_pr or weight > current_weight_pr.value):
            new_prs.append('weight')
        if (not current_reps_pr or reps > current_reps_pr.value):
            new_prs.append('reps')
        
        return jsonify({
            'message': 'Workout added successfully', 
            'id': workout.id,
            'prs_achieved': new_prs,
            'exercise': exercise_name,
            'weight': weight,
            'reps': reps
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/workouts')
@login_required
def get_workouts():
    try:
        workouts = Workout.query.filter_by(user_id=current_user.id).order_by(Workout.date.desc()).all()
        return jsonify([{
            'id': w.id,
            'date': w.date.strftime('%Y-%m-%d'),
            'exercise': w.exercise,
            'category': w.category,
            'weight': w.weight,
            'reps': w.reps,
            'sets': w.sets
        } for w in workouts])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/add_activity', methods=['POST'])
@login_required
def add_activity():
    try:
        data = request.form
        date = datetime.strptime(data.get('activity_date'), '%Y-%m-%d').date()
        activity_type = data.get('activity_type')
        duration = float(data.get('duration'))
        intensity = data.get('intensity')
        miles = float(data.get('miles')) if data.get('miles') else None
        
        # Calculate calories burned based on intensity
        calories_burned = 0
        if intensity == 'Low':
            calories_burned = int(duration * 3.5)
        elif intensity == 'Moderate':
            calories_burned = int(duration * 7)
        elif intensity == 'High':
            calories_burned = int(duration * 10)
        
        activity = Activity(
            user_id=current_user.id,
            date=date,
            activity_type=activity_type,
            duration=duration,
            intensity=intensity,
            calories_burned=calories_burned,
            miles=miles
        )
        db.session.add(activity)
        db.session.commit()
        update_tdee_for_date(current_user.id, date)
        return jsonify({'message': 'Activity added successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/activities')
@login_required
def get_activities():
    try:
        date_str = request.args.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        activities = Activity.query.filter_by(user_id=current_user.id, date=date).all()
        return jsonify([{
            'id': a.id,
            'date': a.date.strftime('%Y-%m-%d'),
            'activity_type': a.activity_type,
            'duration': a.duration,
            'intensity': a.intensity,
            'calories_burned': a.calories_burned,
            'miles': a.miles
        } for a in activities])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/edit_activity/<int:id>', methods=['PUT'])
@login_required
def edit_activity(id):
    try:
        activity = Activity.query.get_or_404(id)
        if activity.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        data = request.get_json()
        activity.date = datetime.strptime(data.get('activity_date'), '%Y-%m-%d').date()
        activity.activity_type = data.get('activity_type')
        activity.duration = float(data.get('duration'))
        activity.intensity = data.get('intensity')
        activity.miles = float(data.get('miles')) if data.get('miles') else None
        
        # Calculate calories burned based on intensity
        calories_burned = 0
        if activity.intensity == 'Low':
            calories_burned = int(activity.duration * 3.5)
        elif activity.intensity == 'Moderate':
            calories_burned = int(activity.duration * 7)
        elif activity.intensity == 'High':
            calories_burned = int(activity.duration * 10)
        activity.calories_burned = calories_burned
        db.session.commit()
        update_tdee_for_date(current_user.id, activity.date)
        return jsonify({'message': 'Activity updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/delete_activity/<int:id>', methods=['DELETE'])
@login_required
def delete_activity(id):
    try:
        activity = Activity.query.get_or_404(id)
        if activity.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        date = activity.date
        db.session.delete(activity)
        db.session.commit()
        update_tdee_for_date(current_user.id, date)
        return jsonify({'message': 'Activity deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/add_manual_calories', methods=['POST'])
@login_required
def add_manual_calories():
    """Add manual calorie and macro inputs for a specific date."""
    try:
        data = request.form
        date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()
        calories = int(data.get('calories', 0))
        protein = float(data.get('protein', 0))
        carbs = float(data.get('carbs', 0))
        fat = float(data.get('fat', 0))
        
        # Check if there are already logged food entries for this date
        existing_logged_entries = FoodEntry.query.filter_by(
            user_id=current_user.id, 
            date=date
        ).filter(FoodEntry.food_name != 'Manual Entry').all()
        
        if existing_logged_entries:
            # If logged food entries exist, use those instead of manual input
            total_calories = sum(e.calories for e in existing_logged_entries if e.calories)
            total_protein = sum(e.protein for e in existing_logged_entries if e.protein)
            total_carbs = sum(e.carbs for e in existing_logged_entries if e.carbs)
            total_fat = sum(e.fat for e in existing_logged_entries if e.fat)
            
            return jsonify({
                'message': 'Logged food entries already exist for this date. Using logged food data instead of manual input.',
                'calories': total_calories,
                'protein': total_protein,
                'carbs': total_carbs,
                'fat': total_fat,
                'source': 'logged_food',
                'priority_override': True
            })
        
        # Check if there's already a manual entry for this date
        existing_manual_entry = FoodEntry.query.filter_by(
            user_id=current_user.id, 
            date=date,
            food_name='Manual Entry'
        ).first()
        
        if existing_manual_entry:
            # Update existing manual entry
            existing_manual_entry.calories = calories
            existing_manual_entry.protein = protein
            existing_manual_entry.carbs = carbs
            existing_manual_entry.fat = fat
            message = 'Manual calories updated successfully'
        else:
            # Create a new manual food entry
            manual_entry = FoodEntry(
                user_id=current_user.id,
                date=date,
                food_name='Manual Entry',
                calories=calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                quantity=1,
                unit='manual'
            )
            db.session.add(manual_entry)
            message = 'Manual calories added successfully'
        
        db.session.commit()
        update_tdee_for_date(current_user.id, date)
        
        return jsonify({
            'message': message,
            'calories': calories,
            'protein': protein,
            'carbs': carbs,
            'fat': fat,
            'source': 'manual_input'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/daily_nutrition/<date>')
@login_required
def get_daily_nutrition(date):
    """Get nutrition data for a specific date, prioritizing logged food over manual input."""
    try:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        # Get all food entries for the date
        food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=target_date).all()
        
        if not food_entries:
            return jsonify({
                'date': date,
                'calories': 0,
                'protein': 0,
                'carbs': 0,
                'fat': 0,
                'source': 'none',
                'entries': []
            })
        
        # Calculate totals
        total_calories = sum(e.calories for e in food_entries if e.calories)
        total_protein = sum(e.protein for e in food_entries if e.protein)
        total_carbs = sum(e.carbs for e in food_entries if e.carbs)
        total_fat = sum(e.fat for e in food_entries if e.fat)
        
        # Determine source (logged food takes priority)
        has_logged_food = any(e.food_name != 'Manual Entry' for e in food_entries)
        source = 'logged_food' if has_logged_food else 'manual_input'
        
        # Format entries for response
        entries = [{
            'id': e.id,
            'food_name': e.food_name,
            'calories': e.calories,
            'protein': e.protein,
            'carbs': e.carbs,
            'fat': e.fat,
            'quantity': e.quantity,
            'unit': e.unit,
            'is_manual': e.food_name == 'Manual Entry'
        } for e in food_entries]
        
        return jsonify({
            'date': date,
            'calories': total_calories,
            'protein': total_protein,
            'carbs': total_carbs,
            'fat': total_fat,
            'source': source,
            'entries': entries
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/delete_food_entry/<int:id>', methods=['DELETE'])
@login_required
def delete_food_entry(id):
    """Delete a food entry."""
    try:
        entry = FoodEntry.query.get_or_404(id)
        if entry.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        date = entry.date
        db.session.delete(entry)
        db.session.commit()
        update_tdee_for_date(current_user.id, date)
        return jsonify({'message': 'Food entry deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/edit_food_entry/<int:id>', methods=['PUT'])
@login_required
def edit_food_entry(id):
    """Edit a food entry."""
    try:
        entry = FoodEntry.query.get_or_404(id)
        if entry.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        # Update the entry
        entry.date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()
        entry.food_name = data.get('food_name')
        entry.calories = int(data.get('calories', 0))
        entry.protein = float(data.get('protein', 0))
        entry.carbs = float(data.get('carbs', 0))
        entry.fat = float(data.get('fat', 0))
        entry.quantity = float(data.get('quantity', 1))
        entry.unit = data.get('unit', 'manual')
        
        db.session.commit()
        update_tdee_for_date(current_user.id, entry.date)
        
        return jsonify({'message': 'Food entry updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/delete_stat/<int:id>', methods=['DELETE'])
@login_required
def delete_stat(id):
    """Delete a stat entry by ID."""
    try:
        stat = Stat.query.filter_by(id=id, user_id=current_user.id).first()
        if not stat:
            return jsonify({'error': 'Stat not found or access denied'}), 404
        
        # Delete associated image file if it exists
        if stat.bodyscan_image_path:
            try:
                image_path = os.path.join(current_app.root_path, stat.bodyscan_image_path)
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception as e:
                current_app.logger.warning(f"Failed to delete image file: {e}")
        
        db.session.delete(stat)
        db.session.commit()
        
        # Update TDEE records after stat deletion
        update_all_tdee_records(current_user.id)
        
        return jsonify({'message': 'Stat deleted successfully'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting stat: {str(e)}")
        return jsonify({'error': 'Failed to delete stat'}), 500

@fitness_bp.route('/record_daily_tdee', methods=['POST'])
@login_required
def record_daily_tdee():
    """Manually records the TDEE for a given date."""
    try:
        data = request.get_json()
        date_str = data.get('date')
        activity_level = data.get('activity_level')
        
        if not date_str:
            return jsonify({'error': 'Date is required'}), 400
            
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        print(f"Recording TDEE for user {current_user.id} on date {date} (activity_level={activity_level})")
        
        # The TDEE calculation is triggered here and saved to DB
        tdee_record = update_tdee_for_date(current_user.id, date, activity_level=activity_level)
        
        if tdee_record:
            print(f"TDEE record created/updated: ID={tdee_record.id}, TDEE={tdee_record.tdee}")
            # Verify the record exists in database
            db.session.refresh(tdee_record)
            print(f"Record verified in DB: ID={tdee_record.id}")
            return jsonify({
                'message': 'TDEE recorded successfully',
                'tdee': tdee_record.tdee
            }), 200
        else:
            print(f"Failed to create TDEE record for user {current_user.id} on date {date}")
            return jsonify({'error': 'Failed to calculate or record TDEE. User profile might be incomplete.'}), 400
            
    except Exception as e:
        print(f"Error in record_daily_tdee: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/tdee/<int:tdee_id>', methods=['GET'])
@login_required
def get_tdee_record(tdee_id):
    """Fetch a single TDEE record by its ID."""
    tdee = TDEE.query.filter_by(id=tdee_id, user_id=current_user.id).first_or_404()
    return jsonify({
        'id': tdee.id,
        'date': tdee.date.strftime('%Y-%m-%d'),
        'bmr': tdee.bmr,
        'activity_calories': tdee.activity_calories,
        'calorie_intake': tdee.calorie_intake
    })

@fitness_bp.route('/api/tdee/update/<int:tdee_id>', methods=['POST'])
@login_required
def update_tdee_record(tdee_id):
    """Update a historical TDEE record."""
    try:
        tdee = TDEE.query.filter_by(id=tdee_id, user_id=current_user.id).first_or_404()
        data = request.get_json()

        # Update the manually editable fields
        tdee.bmr = int(data.get('bmr', tdee.bmr))
        tdee.activity_calories = int(data.get('activity_calories', tdee.activity_calories))
        tdee.calorie_intake = int(data.get('calorie_intake', tdee.calorie_intake))

        # Recalculate dependent fields
        if tdee.activity_multiplier:
             tdee.base_tdee = round(tdee.bmr * tdee.activity_multiplier)
        else:
             # Fallback to a default multiplier if not set
             tdee.base_tdee = round(tdee.bmr * 1.375)

        tdee.tdee = tdee.base_tdee + tdee.activity_calories

        db.session.commit()
        
        return jsonify({'message': 'TDEE record updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/exercise_categories')
@login_required
def get_exercise_categories():
    """Get all exercise categories."""
    try:
        categories = ExerciseCategory.query.all()
        return jsonify([{
            'id': cat.id,
            'name': cat.name,
            'description': cat.description
        } for cat in categories])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/exercises/<int:category_id>')
@login_required
def get_exercises_by_category(category_id):
    try:
        # System exercises
        exercises = Exercise.query.filter_by(category_id=category_id).all()
        # User custom exercises
        custom_exercises = UserExercise.query.filter_by(user_id=current_user.id, category_id=category_id).all()
        favorite_ids = {fav.id for fav in current_user.favorite_exercises}
        # Combine and mark custom exercises
        result = []
        for ex in exercises:
            result.append({
                'id': ex.id,
                'name': ex.name,
                'description': ex.description,
                'equipment': ex.equipment,
                'muscle_groups': ex.muscle_groups,
                'category_id': ex.category_id,
                'is_favorite': ex.id in favorite_ids,
                'is_custom': False
            })
        for ex in custom_exercises:
            result.append({
                'id': f'custom-{ex.id}',
                'name': ex.name,
                'description': ex.description,
                'equipment': ex.equipment,
                'muscle_groups': ex.muscle_groups,
                'category_id': ex.category_id,
                'is_favorite': False,  # Custom exercises are not favorited in this system
                'is_custom': True
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/exercises')
@login_required
def get_all_exercises():
    """Get all exercises with their categories."""
    try:
        exercises = Exercise.query.join(ExerciseCategory).all()
        return jsonify([{
            'id': ex.id,
            'name': ex.name,
            'description': ex.description,
            'equipment': ex.equipment,
            'muscle_groups': ex.muscle_groups,
            'category_id': ex.category_id,
            'category_name': ex.category.name
        } for ex in exercises])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workouts_by_date')
@login_required
def get_workouts_by_date():
    try:
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'error': 'Date parameter is required'}), 400
        
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        workouts = Workout.query.filter_by(
            user_id=current_user.id,
            date=date
        ).order_by(Workout.id).all()

        result = []
        for w in workouts:
            # Look up exercise information to get category_id and category name
            exercise = Exercise.query.filter_by(name=w.exercise).first()
            category_id = exercise.category_id if exercise else None
            category_name = None
            if category_id is not None:
                try:
                    category_id_int = int(category_id)
                    category = ExerciseCategory.query.get(category_id_int)
                    if category:
                        category_name = category.name
                except (ValueError, TypeError):
                    category_name = None
            
            workout_data = {
                'id': w.id,
                'date': w.date.strftime('%Y-%m-%d'),
                'exercise': w.exercise,
                'category': category_name,  # Use the looked-up category name
                'category_id': category_id,
                'weight': w.weight,
                'reps': w.reps,
                'sets': w.sets
            }
            
            workout_data['prs_achieved'] = get_prs_achieved(current_user.id, w.exercise, w.weight, w.reps, w.sets, w.id)
            result.append(workout_data)

        return jsonify(result)
    except Exception as e:
        print(f"Error in get_workouts_by_date: {str(e)}")  # Debug log
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/favorites', methods=['GET'])
@login_required
def get_favorite_exercises():
    """Get the current user's favorite exercises."""
    try:
        return jsonify([{
            'id': ex.id,
            'name': ex.name,
            'category_name': ex.category.name,
            'is_favorite': True
        } for ex in current_user.favorite_exercises])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/exercise/<int:exercise_id>/favorite', methods=['POST'])
@login_required
def toggle_favorite(exercise_id):
    try:
        exercise = Exercise.query.get_or_404(exercise_id)
        
        # Check if already favorited
        existing_favorite = UserFavoriteExercise.query.filter_by(
            user_id=current_user.id, 
            exercise_id=exercise_id
        ).first()
        
        if existing_favorite:
            # Remove from favorites
            db.session.delete(existing_favorite)
            message = f"{exercise.name} removed from favorites"
        else:
            # Add to favorites
            new_favorite = UserFavoriteExercise(
                user_id=current_user.id,
                exercise_id=exercise_id
            )
            db.session.add(new_favorite)
            message = f"{exercise.name} added to favorites"
        
        db.session.commit()
        return jsonify({'message': message, 'is_favorite': existing_favorite is None})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/latest_weight')
@login_required
def get_latest_weight():
    """Get the user's latest weight from stats."""
    try:
        latest_stat = Stat.query.filter_by(user_id=current_user.id).order_by(Stat.date.desc()).first()
        
        if latest_stat and latest_stat.weight:
            return jsonify({
                'weight': latest_stat.weight,
                'date': latest_stat.date.strftime('%Y-%m-%d'),
                'change': None  # Could calculate change from previous entry if needed
            })
        else:
            return jsonify({
                'weight': None,
                'date': None,
                'change': None
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/recent_activity')
@login_required
def get_recent_activity():
    """Get recent activity timeline for the dashboard."""
    try:
        # Get recent stats (last 7 days)
        from datetime import timedelta
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=7)
        
        recent_stats = Stat.query.filter(
            Stat.user_id == current_user.id,
            Stat.date >= start_date,
            Stat.date <= end_date
        ).order_by(Stat.date.desc()).limit(3).all()
        
        # Get recent workouts (last 7 days)
        recent_workouts = Workout.query.filter(
            Workout.user_id == current_user.id,
            Workout.date >= start_date,
            Workout.date <= end_date
        ).order_by(Workout.date.desc()).limit(3).all()
        
        # Get recent food entries (last 7 days)
        recent_food = FoodEntry.query.filter(
            FoodEntry.user_id == current_user.id,
            FoodEntry.date >= start_date,
            FoodEntry.date <= end_date
        ).order_by(FoodEntry.date.desc()).limit(3).all()
        
        # Combine and format activities
        activities = []
        
        for stat in recent_stats:
            days_ago = (end_date - stat.date).days
            time_ago = f"{days_ago} day{'s' if days_ago != 1 else ''} ago" if days_ago > 0 else "Today"
            
            activities.append({
                'type': 'weight',
                'title': 'Weight Logged',
                'description': f"{stat.weight} lbs",
                'date': stat.date.strftime('%Y-%m-%d'),
                'time_ago': time_ago,
                'icon': '⚖️'
            })
        
        for workout in recent_workouts:
            days_ago = (end_date - workout.date).days
            time_ago = f"{days_ago} day{'s' if days_ago != 1 else ''} ago" if days_ago > 0 else "Today"
            
            activities.append({
                'type': 'workout',
                'title': 'Workout Completed',
                'description': workout.exercise,
                'date': workout.date.strftime('%Y-%m-%d'),
                'time_ago': time_ago,
                'icon': '🏋️'
            })
        
        for food in recent_food:
            days_ago = (end_date - food.date).days
            time_ago = f"{days_ago} day{'s' if days_ago != 1 else ''} ago" if days_ago > 0 else "Today"
            
            activities.append({
                'type': 'food',
                'title': 'Food Logged',
                'description': f"{food.calories} calories",
                'date': food.date.strftime('%Y-%m-%d'),
                'time_ago': time_ago,
                'icon': '🍎'
            })
        
        # Sort by date (most recent first) and limit to 5 items
        activities.sort(key=lambda x: x['date'], reverse=True)
        activities = activities[:5]
        
        return jsonify(activities)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/weekly_workouts')
@login_required
def get_weekly_workouts():
    """Get the count of workouts for the current week."""
    try:
        from datetime import timedelta
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=7)
        
        weekly_workouts = Workout.query.filter(
            Workout.user_id == current_user.id,
            Workout.date >= start_date,
            Workout.date <= end_date
        ).count()
        
        return jsonify({'count': weekly_workouts})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/edit_stat/<int:id>', methods=['PUT'])
@login_required
def edit_stat(id):
    try:
        stat = Stat.query.filter_by(id=id, user_id=current_user.id).first()
        if not stat:
            return jsonify({'error': 'Stat not found or access denied'}), 404
        data = request.get_json()
        # Only update fields that are present in the request
        editable_fields = [
            'date', 'weight', 'body_fat_percentage', 'smm', 'body_fat_mass', 'lean_body_mass', 'bmr',
            'resting_heart_rate', 'bicep_measurement', 'chest_measurement', 'waist_measurement',
            'butt_measurement', 'quad_measurement', 'left_arm_lean_mass', 'right_arm_lean_mass',
            'left_leg_lean_mass', 'right_leg_lean_mass', 'trunk_lean_mass'
        ]
        for field in editable_fields:
            if field in data:
                value = data[field]
                if value == '':
                    value = None
                if field == 'date' and value:
                    setattr(stat, field, datetime.strptime(value, '%Y-%m-%d').date())
                elif value is not None:
                    # Convert to float or int as appropriate
                    col_type = type(getattr(Stat, field).type)
                    if col_type == db.Integer:
                        setattr(stat, field, int(value))
                    elif col_type == db.Float:
                        setattr(stat, field, float(value))
                    else:
                        setattr(stat, field, value)
                else:
                    setattr(stat, field, None)
        db.session.commit()
        update_all_tdee_records(current_user.id)
        return jsonify({'message': 'Stat updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/workout_entry')
@login_required
def workout_entry():
    category_id = request.args.get('category_id')
    category_name = request.args.get('category_name')
    exercise = request.args.get('exercise')
    return render_template('workout_entry.html', category_id=category_id, category_name=category_name, exercise=exercise)

@fitness_bp.route('/upload_progress_pic', methods=['POST'])
@login_required
def upload_progress_pic():
    """Upload a progress picture."""
    try:
        if 'progress_pic' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['progress_pic']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Create progress_pics directory if it doesn't exist
            progress_pics_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'progress_pics')
            os.makedirs(progress_pics_dir, exist_ok=True)
            
            # Generate unique filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"progress_{current_user.id}_{timestamp}_{secure_filename(file.filename)}"
            filepath = os.path.join(progress_pics_dir, filename)
            
            # Save file
            file.save(filepath)
            
            # Save to database
            progress_pic = ProgressPic(
                user_id=current_user.id,
                filename=filename,
                upload_date=datetime.now().date(),
                description=request.form.get('description', '')
            )
            db.session.add(progress_pic)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'filename': filename,
                'id': progress_pic.id
            })
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/progress_pics')
@login_required
def get_progress_pics():
    """Get user's progress pictures."""
    try:
        progress_pics = ProgressPic.query.filter_by(user_id=current_user.id).order_by(ProgressPic.upload_date.desc()).all()
        return jsonify([{
            'id': pic.id,
            'filename': pic.filename,
            'upload_date': pic.upload_date.strftime('%Y-%m-%d'),
            'description': pic.description
        } for pic in progress_pics])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/delete_progress_pic/<int:pic_id>', methods=['DELETE'])
@login_required
def delete_progress_pic(pic_id):
    """Delete a progress picture."""
    try:
        progress_pic = ProgressPic.query.filter_by(id=pic_id, user_id=current_user.id).first()
        if not progress_pic:
            return jsonify({'error': 'Progress picture not found'}), 404
        
        # Delete file from filesystem
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], 'progress_pics', progress_pic.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        
        # Delete from database
        db.session.delete(progress_pic)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/edit_workout/<int:workout_id>', methods=['PUT'])
@login_required
def edit_workout(workout_id):
    try:
        workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
        if not workout:
            return jsonify({'error': 'Workout not found or access denied'}), 404
        
        data = request.get_json()
        new_weight = float(data.get('weight', workout.weight))
        new_reps = int(data.get('reps', workout.reps))
        
        # Check current PRs before updating
        current_weight_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=workout.exercise, 
            pr_type='weight'
        ).first()
        current_reps_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=workout.exercise, 
            pr_type='reps'
        ).first()
        
        # Update workout data
        workout.weight = new_weight
        workout.reps = new_reps
        
        db.session.commit()
        
        # Recalculate PRs for this exercise
        recalculate_prs_for_exercise(current_user.id, workout.exercise)
        
        # Check which PRs were newly achieved
        new_prs = []
        if (not current_weight_pr or new_weight > current_weight_pr.value):
            new_prs.append('weight')
        if (not current_reps_pr or new_reps > current_reps_pr.value):
            new_prs.append('reps')
        
        return jsonify({
            'message': 'Workout updated successfully',
            'prs_updated': new_prs,
            'exercise': workout.exercise,
            'weight': new_weight,
            'reps': new_reps
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/delete_workout/<int:workout_id>', methods=['DELETE'])
@login_required
def delete_workout(workout_id):
    try:
        workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
        if not workout:
            return jsonify({'error': 'Workout not found or access denied'}), 404
        
        # Delete the workout
        db.session.delete(workout)
        db.session.commit()
        
        # Recalculate PRs for this exercise
        recalculate_prs_for_exercise(current_user.id, workout.exercise)
        return jsonify({'message': 'Workout deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@fitness_bp.route('/api/personal_records')
@login_required
def get_personal_records():
    prs = PersonalRecord.query.filter_by(user_id=current_user.id).all()
    return jsonify([
        {
            'exercise': pr.exercise,
            'pr_type': pr.pr_type,
            'value': pr.value,
            'date_achieved': pr.date_achieved.strftime('%Y-%m-%d'),
            'workout_id': pr.workout_id
        } for pr in prs
    ])

@fitness_bp.route('/api/personal_records/<exercise>')
@login_required
def get_exercise_prs(exercise):
    prs = PersonalRecord.query.filter_by(user_id=current_user.id, exercise=exercise).all()
    return jsonify([
        {
            'pr_type': pr.pr_type,
            'value': pr.value,
            'date_achieved': pr.date_achieved.strftime('%Y-%m-%d'),
            'workout_id': pr.workout_id
        } for pr in prs
    ])

# Utility function for PR detection

def get_prs_achieved(user_id, exercise, weight, reps, sets, workout_id):
    prs_achieved = []
    for pr_type in ['weight', 'reps', 'volume']:
        pr = PersonalRecord.query.filter_by(user_id=user_id, exercise=exercise, pr_type=pr_type).first()
        if pr and pr.workout_id == workout_id:
            prs_achieved.append(pr_type)
    return prs_achieved

# Minimal PR update function

def update_prs_for_workout(user_id, exercise, weight, reps, sets, workout_id, date):
    from models import PersonalRecord
    # Weight PR
    pr_weight = PersonalRecord.query.filter_by(user_id=user_id, exercise=exercise, pr_type='weight').first()
    if not pr_weight or weight > pr_weight.value:
        if pr_weight:
            db.session.delete(pr_weight)
            db.session.flush()  # Ensure deletion is processed
        new_pr = PersonalRecord(
            user_id=user_id,
            exercise=exercise,
            pr_type='weight',
            value=weight,
            weight=weight,
            reps=reps,
            sets=sets,
            date_achieved=date,
            workout_id=workout_id
        )
        db.session.add(new_pr)
    # Reps PR
    pr_reps = PersonalRecord.query.filter_by(user_id=user_id, exercise=exercise, pr_type='reps').first()
    if not pr_reps or reps > pr_reps.value:
        if pr_reps:
            db.session.delete(pr_reps)
            db.session.flush()  # Ensure deletion is processed
        new_pr = PersonalRecord(
            user_id=user_id,
            exercise=exercise,
            pr_type='reps',
            value=reps,
            weight=weight,
            reps=reps,
            sets=sets,
            date_achieved=date,
            workout_id=workout_id
        )
        db.session.add(new_pr)
    db.session.commit()

def recalculate_prs_for_exercise(user_id, exercise):
    """Recalculate PRs for an exercise after a workout is deleted or modified."""
    from models import PersonalRecord, Workout
    
    # Get all workouts for this user and exercise
    workouts = Workout.query.filter_by(user_id=user_id, exercise=exercise).order_by(Workout.date.desc()).all()
    
    # Delete existing PRs for this exercise
    PersonalRecord.query.filter_by(user_id=user_id, exercise=exercise).delete()
    db.session.flush()
    
    # Find the best weight and reps
    best_weight = 0
    best_reps = 0
    best_weight_workout = None
    best_reps_workout = None
    
    for workout in workouts:
        if workout.weight > best_weight:
            best_weight = workout.weight
            best_weight_workout = workout
        if workout.reps > best_reps:
            best_reps = workout.reps
            best_reps_workout = workout
    
    # Create new PRs if we found better values
    if best_weight_workout:
        weight_pr = PersonalRecord(
            user_id=user_id,
            exercise=exercise,
            pr_type='weight',
            value=best_weight,
            weight=best_weight,
            reps=best_weight_workout.reps,
            sets=best_weight_workout.sets,
            date_achieved=best_weight_workout.date,
            workout_id=best_weight_workout.id
        )
        db.session.add(weight_pr)
    
    if best_reps_workout:
        reps_pr = PersonalRecord(
            user_id=user_id,
            exercise=exercise,
            pr_type='reps',
            value=best_reps,
            weight=best_reps_workout.weight,
            reps=best_reps,
            sets=best_reps_workout.sets,
            date_achieved=best_reps_workout.date,
            workout_id=best_reps_workout.id
        )
        db.session.add(reps_pr)
    
    db.session.commit()

# Fasting routes
@fitness_bp.route('/start_fasting', methods=['POST'])
@login_required
def start_fasting():
    try:
        # Check if there's already an active fast
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if active_fast:
            return jsonify({'error': 'You already have an active fasting period'}), 400
        
        # Create new fasting period
        new_fast = FastingPeriod(user_id=current_user.id)
        db.session.add(new_fast)
        db.session.commit()
        
        return jsonify({
            'message': 'Fasting started successfully',
            'fast_id': new_fast.id,
            'start_time': new_fast.start_time.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/stop_fasting', methods=['POST'])
@login_required
def stop_fasting():
    try:
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if not active_fast:
            return jsonify({'error': 'No active fasting period found'}), 400
        
        # Calculate duration
        end_time = datetime.utcnow()
        duration = (end_time - active_fast.start_time).total_seconds() / 60
        
        active_fast.end_time = end_time
        active_fast.duration_minutes = int(duration)
        active_fast.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Fasting stopped successfully',
            'duration_minutes': active_fast.duration_minutes
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/current_fast')
@login_required
def get_current_fast():
    try:
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if not active_fast:
            return jsonify({'active': False})
        
        # Calculate current duration
        current_time = datetime.utcnow()
        duration = (current_time - active_fast.start_time).total_seconds() / 60
        
        return jsonify({
            'active': True,
            'fast_id': active_fast.id,
            'start_time': active_fast.start_time.isoformat(),
            'duration_minutes': int(duration)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/fasting_history')
@login_required
def get_fasting_history():
    try:
        fasts = FastingPeriod.query.filter_by(
            user_id=current_user.id
        ).order_by(FastingPeriod.start_time.desc()).limit(10).all()
        
        history = []
        for fast in fasts:
            history.append({
                'id': fast.id,
                'start_time': fast.start_time.isoformat(),
                'end_time': fast.end_time.isoformat() if fast.end_time else None,
                'duration_minutes': fast.duration_minutes,
                'status': fast.status
            })
        
        return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/fasting_stats')
@login_required
def get_fasting_stats():
    try:
        completed_fasts = FastingPeriod.query.filter_by(
            user_id=current_user.id,
            status='completed'
        ).all()
        
        if not completed_fasts:
            return jsonify({
                'total_fasts': 0,
                'total_hours': 0,
                'longest_fast': 0,
                'average_fast': 0
            })
        
        total_fasts = len(completed_fasts)
        total_hours = sum(fast.duration_minutes for fast in completed_fasts) / 60
        longest_fast = max(fast.duration_minutes for fast in completed_fasts) / 60
        average_fast = total_hours / total_fasts
        
        return jsonify({
            'total_fasts': total_fasts,
            'total_hours': round(total_hours, 1),
            'longest_fast': round(longest_fast, 1),
            'average_fast': round(average_fast, 1)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Distance Milestone routes
@fitness_bp.route('/set_milestone', methods=['POST'])
@login_required
def set_milestone():
    try:
        data = request.get_json()
        trail_name = data.get('trail_name')
        
        # Trail definitions
        trails = {
            'appalachian': {
                'name': 'Appalachian Trail',
                'distance': 2190,
                'description': 'Hike from Georgia to Maine across 14 states'
            },
            'pacific_crest': {
                'name': 'Pacific Crest Trail',
                'distance': 2650,
                'description': 'Hike from Mexico to Canada along the West Coast'
            },
            'continental_divide': {
                'name': 'Continental Divide Trail',
                'distance': 3100,
                'description': 'Hike along the Continental Divide from Mexico to Canada'
            },
            'camino_santiago': {
                'name': 'Camino de Santiago',
                'distance': 500,
                'description': 'Pilgrimage route to Santiago de Compostela in Spain'
            },
            'john_muir': {
                'name': 'John Muir Trail',
                'distance': 211,
                'description': 'Hike through the Sierra Nevada mountains'
            },
            'tahoe_rim': {
                'name': 'Tahoe Rim Trail',
                'distance': 165,
                'description': 'Circumnavigate Lake Tahoe'
            },
            'wonderland': {
                'name': 'Wonderland Trail',
                'distance': 93,
                'description': 'Circumnavigate Mount Rainier'
            },
            'angels_landing': {
                'name': 'Angels Landing',
                'distance': 5.4,
                'description': 'Hike to the iconic viewpoint in Zion National Park'
            }
        }
        
        if trail_name not in trails:
            return jsonify({'error': 'Invalid trail selection'}), 400
        
        trail_info = trails[trail_name]
        
        # Deactivate any existing active milestone
        existing_milestone = DistanceMilestone.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if existing_milestone:
            existing_milestone.is_active = False
        
        # Create new milestone
        new_milestone = DistanceMilestone(
            user_id=current_user.id,
            trail_name=trail_info['name'],
            trail_distance=trail_info['distance'],
            completed_distance=0.0,
            is_active=True
        )
        
        db.session.add(new_milestone)
        db.session.commit()
        
        return jsonify({
            'message': f'Milestone set to {trail_info["name"]}',
            'milestone': {
                'id': new_milestone.id,
                'name': trail_info['name'],
                'description': trail_info['description'],
                'total_distance': trail_info['distance'],
                'completed_distance': 0.0
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/current_milestone')
@login_required
def get_current_milestone():
    try:
        milestone = DistanceMilestone.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if not milestone:
            return jsonify({'active': False})
        
        # Calculate progress
        progress_percentage = (milestone.completed_distance / milestone.trail_distance) * 100
        remaining_distance = milestone.trail_distance - milestone.completed_distance
        
        return jsonify({
            'active': True,
            'milestone': {
                'id': milestone.id,
                'name': milestone.trail_name,
                'total_distance': milestone.trail_distance,
                'completed_distance': milestone.completed_distance,
                'remaining_distance': remaining_distance,
                'progress_percentage': round(progress_percentage, 1)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/update_milestone_progress', methods=['POST'])
@login_required
def update_milestone_progress():
    try:
        data = request.get_json()
        additional_distance = data.get('distance', 0)
        
        milestone = DistanceMilestone.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if not milestone:
            return jsonify({'error': 'No active milestone found'}), 400
        
        # Update completed distance
        milestone.completed_distance += additional_distance
        
        # Check if milestone is completed
        if milestone.completed_distance >= milestone.trail_distance:
            milestone.completed_distance = milestone.trail_distance
            milestone.is_active = False  # Mark as completed
        
        db.session.commit()
        
        # Calculate updated progress
        progress_percentage = (milestone.completed_distance / milestone.trail_distance) * 100
        remaining_distance = milestone.trail_distance - milestone.completed_distance
        
        return jsonify({
            'message': f'Progress updated! {additional_distance} miles added.',
            'milestone': {
                'id': milestone.id,
                'name': milestone.trail_name,
                'total_distance': milestone.trail_distance,
                'completed_distance': milestone.completed_distance,
                'remaining_distance': remaining_distance,
                'progress_percentage': round(progress_percentage, 1),
                'completed': not milestone.is_active
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/reset_milestone', methods=['POST'])
@login_required
def reset_milestone():
    try:
        milestone = DistanceMilestone.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if not milestone:
            return jsonify({'error': 'No active milestone found'}), 400
        
        milestone.completed_distance = 0.0
        db.session.commit()
        
        return jsonify({
            'message': 'Milestone progress reset',
            'milestone': {
                'id': milestone.id,
                'name': milestone.trail_name,
                'total_distance': milestone.trail_distance,
                'completed_distance': 0.0,
                'remaining_distance': milestone.trail_distance,
                'progress_percentage': 0.0
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/leaderboard')
@login_required
def leaderboard():
    import traceback
    try:
        from models import User, Workout, Activity
        from sqlalchemy import func, distinct
        # Top by total workouts
        total_workouts = (
            db.session.query(User.username, func.count(Workout.id).label('workout_count'))
            .join(Workout, Workout.user_id == User.id)
            .group_by(User.id)
            .order_by(db.desc('workout_count'))
            .limit(10)
            .all()
        )
        # Top by days active (unique workout dates)
        days_active = (
            db.session.query(User.username, func.count(distinct(func.date(Workout.date))).label('days_active'))
            .join(Workout, Workout.user_id == User.id)
            .group_by(User.id)
            .order_by(db.desc('days_active'))
            .limit(10)
            .all()
        )
        # Top by longest workout streak (consecutive days)
        longest_streak = []
        # Top by miles ran, biked, walked (from Activity table)
        def top_miles(activity_type):
            return (
                db.session.query(User.username, func.sum(Activity.miles).label('total_miles'))
                .join(Activity, Activity.user_id == User.id)
                .filter(Activity.type == activity_type)
                .group_by(User.id)
                .order_by(db.desc('total_miles'))
                .limit(10)
                .all()
            )
        miles_ran = top_miles('Running')
        miles_biked = top_miles('Cycling')
        miles_walked = top_miles('Walking')
        return jsonify({
            'total_workouts': [{'username': row[0], 'workout_count': row[1]} for row in total_workouts],
            'days_active': [{'username': row[0], 'days_active': row[1]} for row in days_active],
            'longest_streak': longest_streak,  # Placeholder for now
            'miles_ran': [{'username': row[0], 'miles': float(row[1] or 0)} for row in miles_ran],
            'miles_biked': [{'username': row[0], 'miles': float(row[1] or 0)} for row in miles_biked],
            'miles_walked': [{'username': row[0], 'miles': float(row[1] or 0)} for row in miles_walked],
        })
    except Exception as e:
        import sys
        tb = traceback.format_exc()
        print(f"LEADERBOARD ERROR: {e}\n{tb}", file=sys.stderr)
        return jsonify({'error': str(e), 'traceback': tb}), 500

# --- Custom Exercise API ---
@fitness_bp.route('/api/custom_exercises', methods=['POST'])
@login_required
def create_custom_exercise():
    data = request.get_json() or request.form
    name = data.get('name')
    category_id = data.get('category_id')
    description = data.get('description', '')  # Optional, default empty string
    equipment = data.get('equipment', '')      # Optional, default empty string
    muscle_groups = data.get('muscle_groups', '')  # Optional, default empty string
    
    if not name or not category_id:
        return jsonify({'error': 'Name and category_id are required'}), 400
    
    # Check for duplicate name for this user
    if UserExercise.query.filter_by(user_id=current_user.id, name=name).first():
        return jsonify({'error': 'You already have a custom exercise with this name.'}), 400
    
    custom_ex = UserExercise(
        user_id=current_user.id,
        name=name,
        category_id=category_id,
        description=description,
        equipment=equipment,
        muscle_groups=muscle_groups
    )
    db.session.add(custom_ex)
    db.session.commit()
    return jsonify({'message': 'Custom exercise created', 'id': custom_ex.id})

@fitness_bp.route('/api/custom_exercises', methods=['GET'])
@login_required
def list_custom_exercises():
    custom_exercises = UserExercise.query.filter_by(user_id=current_user.id).all()
    return jsonify([
        {
            'id': ex.id,
            'name': ex.name,
            'category_id': ex.category_id,
            'description': ex.description,
            'equipment': ex.equipment,
            'muscle_groups': ex.muscle_groups,
            'created_at': ex.created_at.isoformat() if ex.created_at else None
        }
        for ex in custom_exercises
    ])

@fitness_bp.route('/api/custom_exercises/<int:id>', methods=['PUT'])
@login_required
def edit_custom_exercise(id):
    ex = UserExercise.query.filter_by(id=id, user_id=current_user.id).first()
    if not ex:
        return jsonify({'error': 'Custom exercise not found'}), 404
    data = request.get_json() or request.form
    ex.name = data.get('name', ex.name)
    ex.category_id = data.get('category_id', ex.category_id)
    ex.description = data.get('description', ex.description)
    ex.equipment = data.get('equipment', ex.equipment)
    ex.muscle_groups = data.get('muscle_groups', ex.muscle_groups)
    db.session.commit()
    return jsonify({'message': 'Custom exercise updated'})

@fitness_bp.route('/api/custom_exercises/<int:id>', methods=['DELETE'])
@login_required
def delete_custom_exercise(id):
    try:
        exercise = UserExercise.query.filter_by(id=id, user_id=current_user.id).first()
        if not exercise:
            return jsonify({'error': 'Exercise not found'}), 404
        
        db.session.delete(exercise)
        db.session.commit()
        return jsonify({'message': 'Exercise deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# WORKOUT TEMPLATE API ROUTES
# ============================================================================

@fitness_bp.route('/api/workout_templates', methods=['GET'])
@login_required
def get_workout_templates():
    """Get all workout templates for the current user"""
    try:
        templates = WorkoutTemplate.query.filter_by(user_id=current_user.id).order_by(WorkoutTemplate.created_at.desc()).all()
        return jsonify([{
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'notes': template.notes,
            'is_public': template.is_public,
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat(),
            'exercise_count': len(template.exercises)
        } for template in templates])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates', methods=['POST'])
@login_required
def create_workout_template():
    """Create a new workout template"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        notes = data.get('notes', '').strip()
        is_public = data.get('is_public', False)
        exercises = data.get('exercises', [])

        if not name:
            return jsonify({'error': 'Template name is required'}), 400

        # Check if template name already exists for this user
        existing = WorkoutTemplate.query.filter_by(user_id=current_user.id, name=name).first()
        if existing:
            return jsonify({'error': 'A template with this name already exists'}), 400

        template = WorkoutTemplate(
            user_id=current_user.id,
            name=name,
            description=description,
            notes=notes,
            is_public=is_public
        )

        db.session.add(template)
        db.session.commit()

        # --- NEW: Save exercises ---
        from models import Exercise, WorkoutTemplateExercise
        for ex in exercises:
            exercise_id = ex.get('exercise_id')
            order = ex.get('order', 0)
            # Fetch exercise name from Exercise model if possible
            exercise_name = None
            if exercise_id:
                exercise_obj = Exercise.query.get(exercise_id)
                exercise_name = exercise_obj.name if exercise_obj else 'Exercise'
            else:
                exercise_name = ex.get('exercise_name', 'Exercise')

            template_exercise = WorkoutTemplateExercise(
                template_id=template.id,
                exercise_name=exercise_name,
                exercise_id=exercise_id,
                order=order
            )
            db.session.add(template_exercise)
        db.session.commit()
        # --- END NEW ---

        return jsonify({
            'message': 'Workout template created successfully',
            'template': {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'notes': template.notes,
                'is_public': template.is_public,
                'created_at': template.created_at.isoformat(),
                'updated_at': template.updated_at.isoformat()
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>', methods=['GET'])
@login_required
def get_workout_template(template_id):
    """Get a specific workout template with its exercises"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        exercises = []
        for exercise in template.exercises:
            exercise_data = {
                'id': exercise.id,
                'exercise_name': exercise.exercise_name,
                'exercise_id': exercise.exercise_id,
                'order': exercise.order,
                'notes': exercise.notes,
                'target_sets': exercise.target_sets,
                'target_reps': exercise.target_reps,
                'target_weight': exercise.target_weight,
                'rest_time': exercise.rest_time
            }
            if exercise.exercise:
                exercise_data['exercise'] = {
                    'id': exercise.exercise.id,
                    'name': exercise.exercise.name,
                    'category': exercise.exercise.category.name if exercise.exercise.category else None
                }
            exercises.append(exercise_data)
        
        return jsonify({
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'notes': template.notes,
            'is_public': template.is_public,
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat(),
            'exercises': exercises
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>', methods=['PUT'])
@login_required
def update_workout_template(template_id):
    """Update a workout template"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        notes = data.get('notes', '').strip()
        is_public = data.get('is_public', template.is_public)
        
        if not name:
            return jsonify({'error': 'Template name is required'}), 400
        
        # Check if new name conflicts with existing template (excluding current template)
        existing = WorkoutTemplate.query.filter(
            WorkoutTemplate.user_id == current_user.id,
            WorkoutTemplate.name == name,
            WorkoutTemplate.id != template_id
        ).first()
        if existing:
            return jsonify({'error': 'A template with this name already exists'}), 400
        
        template.name = name
        template.description = description
        template.notes = notes
        template.is_public = is_public
        template.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Workout template updated successfully',
            'template': {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'notes': template.notes,
                'is_public': template.is_public,
                'updated_at': template.updated_at.isoformat()
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>', methods=['DELETE'])
@login_required
def delete_workout_template(template_id):
    """Delete a workout template"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': 'Workout template deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>/exercises', methods=['POST'])
@login_required
def add_exercise_to_template(template_id):
    """Add an exercise to a workout template"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        data = request.get_json()
        exercise_name = data.get('exercise_name', '').strip()
        exercise_id = data.get('exercise_id')  # Optional
        order = data.get('order', len(template.exercises))
        notes = data.get('notes', '').strip()
        target_sets = data.get('target_sets')
        target_reps = data.get('target_reps')
        target_weight = data.get('target_weight')
        rest_time = data.get('rest_time')
        
        if not exercise_name:
            return jsonify({'error': 'Exercise name is required'}), 400
        
        # Get the highest order number and add 1
        max_order = db.session.query(func.max(WorkoutTemplateExercise.order)).filter_by(template_id=template_id).scalar() or 0
        order = max_order + 1
        
        template_exercise = WorkoutTemplateExercise(
            template_id=template_id,
            exercise_name=exercise_name,
            exercise_id=exercise_id,
            order=order,
            notes=notes,
            target_sets=target_sets,
            target_reps=target_reps,
            target_weight=target_weight,
            rest_time=rest_time
        )
        
        db.session.add(template_exercise)
        db.session.commit()
        
        return jsonify({
            'message': 'Exercise added to template successfully',
            'exercise': {
                'id': template_exercise.id,
                'exercise_name': template_exercise.exercise_name,
                'exercise_id': template_exercise.exercise_id,
                'order': template_exercise.order,
                'notes': template_exercise.notes,
                'target_sets': template_exercise.target_sets,
                'target_reps': template_exercise.target_reps,
                'target_weight': template_exercise.target_weight,
                'rest_time': template_exercise.rest_time
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>/exercises/<int:exercise_id>', methods=['PUT'])
@login_required
def update_template_exercise(template_id, exercise_id):
    """Update an exercise in a workout template"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        template_exercise = WorkoutTemplateExercise.query.filter_by(
            id=exercise_id, 
            template_id=template_id
        ).first()
        if not template_exercise:
            return jsonify({'error': 'Exercise not found in template'}), 404
        
        data = request.get_json()
        exercise_name = data.get('exercise_name', '').strip()
        exercise_id_new = data.get('exercise_id')
        order = data.get('order')
        notes = data.get('notes', '').strip()
        target_sets = data.get('target_sets')
        target_reps = data.get('target_reps')
        target_weight = data.get('target_weight')
        rest_time = data.get('rest_time')
        
        if not exercise_name:
            return jsonify({'error': 'Exercise name is required'}), 400
        
        template_exercise.exercise_name = exercise_name
        template_exercise.exercise_id = exercise_id_new
        if order is not None:
            template_exercise.order = order
        template_exercise.notes = notes
        template_exercise.target_sets = target_sets
        template_exercise.target_reps = target_reps
        template_exercise.target_weight = target_weight
        template_exercise.rest_time = rest_time
        
        db.session.commit()
        
        return jsonify({
            'message': 'Exercise updated successfully',
            'exercise': {
                'id': template_exercise.id,
                'exercise_name': template_exercise.exercise_name,
                'exercise_id': template_exercise.exercise_id,
                'order': template_exercise.order,
                'notes': template_exercise.notes,
                'target_sets': template_exercise.target_sets,
                'target_reps': template_exercise.target_reps,
                'target_weight': template_exercise.target_weight,
                'rest_time': template_exercise.rest_time
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_templates/<int:template_id>/exercises/<int:exercise_id>', methods=['DELETE'])
@login_required
def delete_template_exercise(template_id, exercise_id):
    """Delete an exercise from a workout template"""
    try:
        template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        template_exercise = WorkoutTemplateExercise.query.filter_by(
            id=exercise_id, 
            template_id=template_id
        ).first()
        if not template_exercise:
            return jsonify({'error': 'Exercise not found in template'}), 404
        
        db.session.delete(template_exercise)
        db.session.commit()
        
        return jsonify({'message': 'Exercise removed from template successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# WORKOUT SESSION API ROUTES
# ============================================================================

@fitness_bp.route('/api/workout_sessions', methods=['GET'])
@login_required
def get_workout_sessions():
    """Get all workout sessions for the current user"""
    try:
        sessions = WorkoutSession.query.filter_by(user_id=current_user.id).order_by(WorkoutSession.date.desc()).all()
        return jsonify([{
            'id': session.id,
            'name': session.name,
            'date': session.date.isoformat(),
            'notes': session.notes,
            'status': session.status,
            'started_at': session.started_at.isoformat() if session.started_at else None,
            'completed_at': session.completed_at.isoformat() if session.completed_at else None,
            'created_at': session.created_at.isoformat(),
            'template_id': session.template_id,
            'exercise_count': len(session.exercises)
        } for session in sessions])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_sessions', methods=['POST'])
@login_required
def create_workout_session():
    """Create a new workout session (from template or scratch)"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        date_str = data.get('date')
        template_id = data.get('template_id')
        notes = data.get('notes', '').strip()
        
        if not name:
            return jsonify({'error': 'Session name is required'}), 400
        
        if not date_str:
            return jsonify({'error': 'Date is required'}), 400
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # If template_id is provided, verify it exists and belongs to user
        if template_id:
            template = WorkoutTemplate.query.filter_by(id=template_id, user_id=current_user.id).first()
            if not template:
                return jsonify({'error': 'Template not found'}), 404
        
        session = WorkoutSession(
            user_id=current_user.id,
            template_id=template_id,
            name=name,
            date=date,
            notes=notes,
            status='planned'
        )
        
        db.session.add(session)
        db.session.commit()
        
        # If created from template, copy exercises
        if template_id and template:
            for template_exercise in template.exercises:
                session_exercise = WorkoutSessionExercise(
                    session_id=session.id,
                    exercise_name=template_exercise.exercise_name,
                    exercise_id=template_exercise.exercise_id,
                    order=template_exercise.order,
                    notes=template_exercise.notes,
                    target_sets=template_exercise.target_sets,
                    target_reps=template_exercise.target_reps,
                    target_weight=template_exercise.target_weight,
                    rest_time=template_exercise.rest_time
                )
                db.session.add(session_exercise)
            
            db.session.commit()
        
        return jsonify({
            'message': 'Workout session created successfully',
            'session': {
                'id': session.id,
                'name': session.name,
                'date': session.date.isoformat(),
                'notes': session.notes,
                'status': session.status,
                'template_id': session.template_id,
                'created_at': session.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ADDITIONAL WORKOUT API ENDPOINTS
# ============================================================================

@fitness_bp.route('/api/todays_workout')
@login_required
def get_todays_workout():
    """Get today's workout entries for the current user"""
    try:
        today = datetime.now().date()
        workouts = Workout.query.filter_by(
            user_id=current_user.id, 
            date=today
        ).order_by(Workout.id.desc()).all()
        
        workout_data = []
        for workout in workouts:
            workout_data.append({
                'id': workout.id,
                'category_name': workout.category_name,
                'exercise_name': workout.exercise_name,
                'set_number': workout.set_number,
                'total_weight': workout.total_weight,
                'reps': workout.reps,
                'date': workout.date.isoformat()
            })
        
        return jsonify(workout_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/workout_history')
@login_required
def get_workout_history():
    """Get workout history for the current user"""
    try:
        workouts = Workout.query.filter_by(user_id=current_user.id).order_by(Workout.date.desc()).limit(100).all()
        
        workout_data = []
        for workout in workouts:
            workout_data.append({
                'id': workout.id,
                'date': workout.date.isoformat(),
                'category_name': workout.category_name,
                'exercise_name': workout.exercise_name,
                'weight': workout.total_weight,
                'reps': workout.reps,
                'sets': workout.set_number
            })
        
        return jsonify(workout_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/todays_sets')
@login_required
def get_todays_sets():
    """Get today's sets for a specific exercise"""
    try:
        exercise = request.args.get('exercise')
        if not exercise:
            return jsonify({'error': 'Exercise parameter is required'}), 400
        
        today = datetime.now().date()
        workouts = Workout.query.filter_by(
            user_id=current_user.id,
            exercise=exercise,
            date=today
        ).order_by(Workout.sets).all()
        
        sets_data = []
        for workout in workouts:
            sets_data.append({
                'id': workout.id,
                'set_number': workout.sets,
                'weight': workout.weight,
                'reps': workout.reps,
                'date': workout.date.isoformat()
            })
        
        return jsonify(sets_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/exercise_history')
@login_required
def get_exercise_history():
    """Get exercise history for a specific exercise"""
    try:
        exercise = request.args.get('exercise')
        if not exercise:
            return jsonify({'error': 'Exercise parameter is required'}), 400
        
        workouts = Workout.query.filter_by(
            user_id=current_user.id,
            exercise=exercise
        ).order_by(Workout.date.desc(), Workout.sets).limit(50).all()
        
        history_data = []
        for workout in workouts:
            history_data.append({
                'id': workout.id,
                'date': workout.date.isoformat(),
                'set_number': workout.sets,
                'weight': workout.weight,
                'reps': workout.reps
            })
        
        return jsonify(history_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/log_set', methods=['POST'])
@login_required
def log_set():
    """Log a new set for an exercise"""
    try:
        data = request.get_json()
        category_id = data.get('category_id')
        exercise = data.get('exercise')
        weight = data.get('weight')
        reps = data.get('reps')
        is_barbell = data.get('is_barbell', False)  # New field to indicate if it's a barbell exercise
        
        if not all([category_id, exercise, weight, reps]):
            return jsonify({'error': 'All fields are required'}), 400
        
        # Get the next set number for today
        today = datetime.now().date()
        last_set = Workout.query.filter_by(
            user_id=current_user.id,
            exercise=exercise,
            date=today
        ).order_by(Workout.sets.desc()).first()
        
        set_number = (last_set.sets + 1) if last_set else 1
        
        # Calculate total weight for barbell exercises
        total_weight = weight
        if is_barbell:
            total_weight = weight + 45  # Standard barbell weight
        
        # Create the workout entry
        workout = Workout(
            user_id=current_user.id,
            category=category_id,
            exercise=exercise,
            sets=set_number,
            weight=weight,  # Store the user's weight (plates only)
            reps=reps,
            date=today
        )
        
        db.session.add(workout)
        db.session.commit()
        
        # Check current PRs before adding the workout
        current_weight_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=exercise, 
            pr_type='weight'
        ).first()
        current_reps_pr = PersonalRecord.query.filter_by(
            user_id=current_user.id, 
            exercise=exercise, 
            pr_type='reps'
        ).first()
        
        # Update PRs (use total weight for barbell exercises)
        pr_weight = total_weight if is_barbell else weight
        update_prs_for_workout(current_user.id, exercise, pr_weight, reps, 1, workout.id, today)
        
        # Check which PRs were newly achieved
        new_prs = []
        if (not current_weight_pr or pr_weight > current_weight_pr.value):
            new_prs.append('weight')
        if (not current_reps_pr or reps > current_reps_pr.value):
            new_prs.append('reps')
        
        return jsonify({
            'id': workout.id,
            'set_number': workout.sets,
            'weight': workout.weight,
            'total_weight': total_weight,
            'reps': workout.reps,
            'date': workout.date.isoformat(),
            'prs_achieved': new_prs
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/sets/<int:set_id>', methods=['DELETE'])
@login_required
def delete_set(set_id):
    """Delete a specific set"""
    try:
        workout = Workout.query.filter_by(id=set_id, user_id=current_user.id).first()
        if not workout:
            return jsonify({'error': 'Set not found'}), 404
        
        db.session.delete(workout)
        db.session.commit()
        
        return jsonify({'message': 'Set deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fitness_bp.route('/api/activity/<int:id>', methods=['GET'])
@login_required
def get_activity(id):
    activity = Activity.query.get_or_404(id)
    if activity.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify({
        'id': activity.id,
        'date': activity.date.strftime('%Y-%m-%d'),
        'activity_type': activity.activity_type,
        'custom_activity_type': getattr(activity, 'custom_activity_type', ''),
        'duration': activity.duration,
        'intensity': activity.intensity,
        'miles': activity.miles,
        'calories_burned': activity.calories_burned
    })

@fitness_bp.route('/api/activity_miles_summary')
@login_required
def activity_miles_summary():
    timeframe = request.args.get('timeframe', '7')
    now = datetime.now().date()
    try:
        days = int(timeframe)
        start_date = now - timedelta(days=days)
    except ValueError:
        return jsonify({'error': 'Invalid timeframe'}), 400

    activities = Activity.query.filter(
        Activity.user_id == current_user.id,
        Activity.date >= start_date,
        Activity.miles != None,
        Activity.activity_type.in_(['Walking', 'Running', 'Cycling'])
    ).all()

    summary = {'Walking': 0, 'Running': 0, 'Cycling': 0}
    for a in activities:
        if a.activity_type in summary and a.miles:
            summary[a.activity_type] += a.miles

    summary = {k: round(v, 2) for k, v in summary.items()}

    return jsonify({'start_date': str(start_date), 'end_date': str(now), 'summary': summary})