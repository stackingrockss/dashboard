from flask import Blueprint, request, jsonify, render_template
from flask_login import login_required, current_user
from models import db, User, UserSettings
from datetime import datetime
import json

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/')
@login_required
def profile_page():
    """Render the profile page."""
    return render_template('profile.html')

@profile_bp.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    """Get user profile data."""
    try:
        user = User.query.get(current_user.id)
        settings = UserSettings.query.filter_by(user_id=current_user.id).first()
        
        # Create default settings if none exist
        if not settings:
            settings = UserSettings(user_id=current_user.id)
            db.session.add(settings)
            db.session.commit()
        
        return jsonify({
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'username': user.username,
                'email': user.email,
                'weight': user.weight,
                'height': user.height,
                'age': user.age,
                'sex': user.sex,
                'birthdate': user.birthdate.strftime('%Y-%m-%d') if user.birthdate else None,
                'created_at': user.created_at.strftime('%Y-%m-%d') if user.created_at else None
            },
            'settings': {
                'theme': settings.theme,
                'units': settings.units,
                'date_format': settings.date_format,
                'activity_level': settings.activity_level,
                'goal': settings.goal,
                'weekly_goal': settings.weekly_goal,
                'calorie_deficit': settings.calorie_deficit,
                'email_notifications': settings.email_notifications,
                'reminder_frequency': settings.reminder_frequency,
                'reminder_time': settings.reminder_time,
                'profile_visibility': settings.profile_visibility,
                'share_progress': settings.share_progress,
                'auto_backup': settings.auto_backup,
                'data_retention_days': settings.data_retention_days
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile data."""
    try:
        data = request.get_json()
        user = User.query.get(current_user.id)
        
        # Track if profile data that affects BMR changed
        bmr_affecting_changed = False
        if ('weight' in data and user.weight != (float(data['weight']) if data['weight'] else None)) or \
           ('height' in data and user.height != (float(data['height']) if data['height'] else None)) or \
           ('age' in data and user.age != (int(data['age']) if data['age'] else None)) or \
           ('sex' in data and user.sex != data['sex']):
            bmr_affecting_changed = True
        
        # Update user profile fields
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'username' in data:
            user.username = data['username']
        if 'weight' in data:
            user.weight = float(data['weight']) if data['weight'] else None
        if 'height' in data:
            user.height = float(data['height']) if data['height'] else None
        if 'age' in data:
            user.age = int(data['age']) if data['age'] else None
        if 'sex' in data:
            user.sex = data['sex']
        if 'birthdate' in data:
            user.birthdate = datetime.strptime(data['birthdate'], '%Y-%m-%d').date() if data['birthdate'] else None
        
        db.session.commit()
        
        # If BMR-affecting data changed, update all TDEE records
        if bmr_affecting_changed:
            from routes.fitness_routes import update_all_tdee_records
            update_all_tdee_records(current_user.id)
        
        return jsonify({'message': 'Profile updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@profile_bp.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    """Update user settings."""
    try:
        data = request.get_json()
        settings = UserSettings.query.filter_by(user_id=current_user.id).first()
        
        if not settings:
            settings = UserSettings(user_id=current_user.id)
            db.session.add(settings)
        
        # Update settings fields
        if 'theme' in data:
            settings.theme = data['theme']
        if 'units' in data:
            settings.units = data['units']
        if 'date_format' in data:
            settings.date_format = data['date_format']
        if 'activity_level' in data:
            settings.activity_level = data['activity_level']
        if 'goal' in data:
            settings.goal = data['goal']
        if 'weekly_goal' in data:
            settings.weekly_goal = float(data['weekly_goal'])
        if 'calorie_deficit' in data:
            settings.calorie_deficit = int(data['calorie_deficit'])
        if 'email_notifications' in data:
            settings.email_notifications = bool(data['email_notifications'])
        if 'reminder_frequency' in data:
            settings.reminder_frequency = data['reminder_frequency']
        if 'reminder_time' in data:
            settings.reminder_time = data['reminder_time']
        if 'profile_visibility' in data:
            settings.profile_visibility = data['profile_visibility']
        if 'share_progress' in data:
            settings.share_progress = bool(data['share_progress'])
        if 'auto_backup' in data:
            settings.auto_backup = bool(data['auto_backup'])
        if 'data_retention_days' in data:
            settings.data_retention_days = int(data['data_retention_days'])
        
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Settings updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@profile_bp.route('/api/account/delete', methods=['DELETE'])
@login_required
def delete_account():
    """Delete user account and all associated data."""
    try:
        user = User.query.get(current_user.id)
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'Account deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@profile_bp.route('/api/data/export', methods=['GET'])
@login_required
def export_data():
    """Export user data as JSON."""
    try:
        from models import Stat, FoodEntry, Workout, Activity, TDEE, Mood
        
        user_data = {
            'profile': {
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'email': current_user.email,
                'created_at': current_user.created_at.strftime('%Y-%m-%d') if current_user.created_at else None
            },
            'stats': [{
                'date': stat.date.strftime('%Y-%m-%d'),
                'weight': stat.weight,
                'body_fat_percentage': stat.body_fat_percentage,
                'measurements': {
                    'bicep': stat.bicep_measurement,
                    'chest': stat.chest_measurement,
                    'waist': stat.waist_measurement,
                    'butt': stat.butt_measurement,
                    'quad': stat.quad_measurement
                }
            } for stat in Stat.query.filter_by(user_id=current_user.id).all()],
            'food_entries': [{
                'date': entry.date.strftime('%Y-%m-%d'),
                'food_name': entry.food_name,
                'calories': entry.calories,
                'protein': entry.protein,
                'carbs': entry.carbs,
                'fat': entry.fat,
                'quantity': entry.quantity,
                'unit': entry.unit
            } for entry in FoodEntry.query.filter_by(user_id=current_user.id).all()],
            'workouts': [{
                'date': workout.date.strftime('%Y-%m-%d'),
                'exercise': workout.exercise,
                'weight': workout.weight,
                'reps': workout.reps,
                'sets': workout.sets
            } for workout in Workout.query.filter_by(user_id=current_user.id).all()],
            'activities': [{
                'date': activity.date.strftime('%Y-%m-%d'),
                'activity_type': activity.activity_type,
                'duration': activity.duration,
                'intensity': activity.intensity,
                'calories_burned': activity.calories_burned
            } for activity in Activity.query.filter_by(user_id=current_user.id).all()],
            'moods': [{
                'date': mood.date.strftime('%Y-%m-%d'),
                'rating': mood.rating,
                'notes': mood.notes
            } for mood in Mood.query.filter_by(user_id=current_user.id).all()]
        }
        
        return jsonify(user_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500 