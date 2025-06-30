from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from models import db, Mood

mood_bp = Blueprint('mood', __name__)

@mood_bp.route('/api/mood')
@login_required
def get_mood():
    try:
        moods = Mood.query.filter_by(user_id=current_user.id).all()
        return jsonify([{
            'id': m.id,
            'date': m.date.isoformat(),
            'rating': m.rating,
            'notes': m.notes
        } for m in moods])
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@mood_bp.route('/add_mood', methods=['POST'])
@login_required
def add_mood():
    try:
        data = request.form
        if not data.get('date') or not data.get('rating'):
            return jsonify({'error': 'Missing required fields'}), 400
        rating = int(data['rating'])
        if rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        mood = Mood(
            user_id=current_user.id,
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            rating=rating,
            notes=data.get('notes')
        )
        db.session.add(mood)
        db.session.commit()
        return jsonify({'message': 'Mood added'}), 200
    except ValueError as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@mood_bp.route('/edit_mood/<int:id>', methods=['PUT'])
@login_required
def edit_mood(id):
    try:
        data = request.json
        mood = Mood.query.filter_by(id=id, user_id=current_user.id).first()
        if not mood:
            return jsonify({'error': 'Mood entry not found'}), 404
        if not data.get('date') or not data.get('rating'):
            return jsonify({'error': 'Missing required fields'}), 400
        rating = int(data['rating'])
        if rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        mood.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        mood.rating = rating
        mood.notes = data.get('notes')
        db.session.commit()
        return jsonify({'message': 'Mood updated'}), 200
    except ValueError as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@mood_bp.route('/delete_mood/<int:id>', methods=['DELETE'])
@login_required
def delete_mood(id):
    try:
        mood = Mood.query.filter_by(id=id, user_id=current_user.id).first()
        if not mood:
            return jsonify({'error': 'Mood entry not found'}), 404
        db.session.delete(mood)
        db.session.commit()
        return jsonify({'message': 'Mood deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500