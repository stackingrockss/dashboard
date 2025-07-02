from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user
from models import db, FoodEntry, FoodReference, FoodCategory, FoodServingSize, FastingPeriod
from datetime import datetime
from sqlalchemy import or_
import json

food_bp = Blueprint('food_bp', __name__)

@food_bp.route('/food')
def food_page():
    return render_template('food_enhanced.html')

@food_bp.route('/search')
def search_food():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'A search query is required.'}), 400

    try:
        # Search in food names and keywords
        search_term = f"%{query}%"
        
        foods = FoodReference.query.filter(
            or_(
                FoodReference.food_name.ilike(search_term),
                FoodReference.search_keywords.ilike(search_term)
            )
        ).limit(20).all()
        
        if not foods:
            # Try broader search
            foods = FoodReference.query.filter(
                FoodReference.food_name.ilike(f"%{query.split()[0]}%")
            ).limit(10).all()
        
        results = []
        for food in foods:
            # Get common serving sizes
            common_servings = food.get_common_serving_sizes()
            default_serving = food.get_default_serving_size()
            
            results.append({
                'id': food.id,
                'name': food.food_name,
                'brand': food.brand or '',
                'category': food.category.name if food.category else '',
                'barcode': food.barcode or '',
                'nutrition': {
                    'calories': food.calories,
                    'protein': food.protein or 0,
                    'carbs': food.carbs or 0,
                    'fat': food.fat or 0,
                    'fiber': food.fiber or 0,
                    'sugar': food.sugar or 0,
                    'sodium': food.sodium or 0
                },
                'serving_size': food.serving_size or '100g',
                'is_verified': food.is_verified,
                'common_serving_sizes': [
                    {
                        'id': serving.id,
                        'description': serving.description,
                        'amount': serving.amount,
                        'unit': serving.unit,
                        'grams_equivalent': serving.grams_equivalent,
                        'is_default': serving.is_default
                    } for serving in common_servings
                ],
                'default_serving_size': {
                    'id': default_serving.id,
                    'description': default_serving.description,
                    'amount': default_serving.amount,
                    'unit': default_serving.unit,
                    'grams_equivalent': default_serving.grams_equivalent
                } if default_serving else None
            })
        
        return jsonify({
            'foods': results,
            'count': len(results)
        })
        
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({'error': 'Search failed. Please try again.'}), 500

@food_bp.route('/barcode/<barcode>')
def search_by_barcode(barcode):
    """Search for food by barcode"""
    if not barcode:
        return jsonify({'error': 'Barcode is required.'}), 400

    try:
        # Search for exact barcode match
        food = FoodReference.query.filter_by(barcode=barcode).first()
        
        if not food:
            return jsonify({
                'error': 'Food not found with this barcode.',
                'barcode': barcode
            }), 404
        
        # Get common serving sizes
        common_servings = food.get_common_serving_sizes()
        default_serving = food.get_default_serving_size()
        
        result = {
            'id': food.id,
            'name': food.food_name,
            'brand': food.brand or '',
            'category': food.category.name if food.category else '',
            'barcode': food.barcode or '',
            'nutrition': {
                'calories': food.calories,
                'protein': food.protein or 0,
                'carbs': food.carbs or 0,
                'fat': food.fat or 0,
                'fiber': food.fiber or 0,
                'sugar': food.sugar or 0,
                'sodium': food.sodium or 0
            },
            'serving_size': food.serving_size or '100g',
            'is_verified': food.is_verified,
            'common_serving_sizes': [
                {
                    'id': serving.id,
                    'description': serving.description,
                    'amount': serving.amount,
                    'unit': serving.unit,
                    'grams_equivalent': serving.grams_equivalent,
                    'is_default': serving.is_default
                } for serving in common_servings
            ],
            'default_serving_size': {
                'id': default_serving.id,
                'description': default_serving.description,
                'amount': default_serving.amount,
                'unit': default_serving.unit,
                'grams_equivalent': default_serving.grams_equivalent
            } if default_serving else None
        }
        
        return jsonify({
            'food': result,
            'found': True
        })
        
    except Exception as e:
        print(f"Barcode search error: {e}")
        return jsonify({'error': 'Barcode search failed. Please try again.'}), 500

@food_bp.route('/serving_sizes/<int:food_id>')
def get_food_serving_sizes(food_id):
    """Get all serving sizes for a specific food"""
    try:
        food = FoodReference.query.get_or_404(food_id)
        serving_sizes = FoodServingSize.query.filter_by(food_id=food_id).order_by(FoodServingSize.amount).all()
        
        return jsonify({
            'food_id': food_id,
            'food_name': food.food_name,
            'serving_sizes': [
                {
                    'id': serving.id,
                    'description': serving.description,
                    'amount': serving.amount,
                    'unit': serving.unit,
                    'grams_equivalent': serving.grams_equivalent,
                    'is_common': serving.is_common,
                    'is_default': serving.is_default
                } for serving in serving_sizes
            ]
        })
        
    except Exception as e:
        print(f"Serving sizes error: {e}")
        return jsonify({'error': 'Failed to get serving sizes'}), 500

@food_bp.route('/nutrition/<int:food_id>')
def get_food_nutrition(food_id):
    """Get nutrition information for a food with specific serving size"""
    try:
        food = FoodReference.query.get_or_404(food_id)
        serving_size_id = request.args.get('serving_size_id', type=int)
        amount = request.args.get('amount', 100, type=float)
        unit = request.args.get('unit', 'g')
        
        nutrition = food.get_nutrition_for_serving(serving_size_id, amount, unit)
        
        return jsonify({
            'food_id': food_id,
            'food_name': food.food_name,
            'amount': amount,
            'unit': unit,
            'serving_size_id': serving_size_id,
            'nutrition': nutrition
        })
        
    except Exception as e:
        print(f"Nutrition calculation error: {e}")
        return jsonify({'error': 'Failed to calculate nutrition'}), 500

@food_bp.route('/food_entry', methods=['POST'])
@login_required
def add_food_entry():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Require calories to be present and > 0
        if 'calories' not in data or float(data.get('calories', 0)) <= 0:
            return jsonify({'error': 'Calories are required and must be greater than zero.'}), 400
        # Optionally require name
        if not data.get('name'):
            return jsonify({'error': 'Food name is required.'}), 400
        
        # Create food entry
        food_entry = FoodEntry()
        food_entry.user_id = current_user.id
        food_entry.date = datetime.now().date()
        food_entry.food_name = data.get('name', '')
        food_entry.calories = int(data.get('calories', 0))
        food_entry.protein = data.get('protein', 0)
        food_entry.carbs = data.get('carbs', 0)
        food_entry.fat = data.get('fat', 0)
        food_entry.quantity = data.get('quantity', 100)
        food_entry.unit = 'g'
        
        db.session.add(food_entry)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Added {data.get("name")} to your food log'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Food entry error: {e}")
        return jsonify({'error': 'Failed to add food entry'}), 500

@food_bp.route('/categories')
def get_categories():
    """Get all food categories"""
    try:
        categories = FoodCategory.query.all()
        return jsonify({
            'categories': [
                {
                    'id': cat.id,
                    'name': cat.name,
                    'description': cat.description,
                    'color': cat.color,
                    'icon': cat.icon
                }
                for cat in categories
            ]
        })
    except Exception as e:
        print(f"Categories error: {e}")
        return jsonify({'error': 'Failed to get categories'}), 500

@food_bp.route('/category/<int:category_id>')
def get_foods_by_category(category_id):
    """Get foods by category"""
    try:
        foods = FoodReference.query.filter_by(category_id=category_id).limit(50).all()
        
        results = []
        for food in foods:
            results.append({
                'id': food.id,
                'name': food.food_name,
                'brand': food.brand or '',
                'nutrition': {
                    'calories': food.calories,
                    'protein': food.protein or 0,
                    'carbs': food.carbs or 0,
                    'fat': food.fat or 0,
                    'fiber': food.fiber or 0,
                    'sugar': food.sugar or 0,
                    'sodium': food.sodium or 0
                },
                'serving_size': food.serving_size or '100g',
                'is_verified': food.is_verified
            })
        
        return jsonify({
            'foods': results,
            'count': len(results)
        })
        
    except Exception as e:
        print(f"Category foods error: {e}")
        return jsonify({'error': 'Failed to get category foods'}), 500

# Fasting Routes

@food_bp.route('/fasting/start', methods=['POST'])
@login_required
def start_fast():
    """Start a new fasting period"""
    try:
        # Check if user already has an active fast
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if active_fast:
            return jsonify({'error': 'You already have an active fast. Please end it first.'}), 400
        
        # Create new fasting period
        fast = FastingPeriod(
            user_id=current_user.id,
            start_time=datetime.utcnow(),
            status='active'
        )
        
        db.session.add(fast)
        db.session.commit()
        
        return jsonify({
            'message': 'Fast started successfully',
            'fast_id': fast.id,
            'start_time': fast.start_time.isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@food_bp.route('/fasting/end', methods=['POST'])
@login_required
def end_fast():
    """End the current active fast"""
    try:
        # Find active fast
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if not active_fast:
            return jsonify({'error': 'No active fast found.'}), 404
        
        # End the fast
        active_fast.end_time = datetime.utcnow()
        active_fast.duration_minutes = active_fast.calculate_duration()
        active_fast.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Fast ended successfully',
            'duration': active_fast.get_duration_display(),
            'duration_minutes': active_fast.duration_minutes
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@food_bp.route('/fasting/current')
@login_required
def get_current_fast():
    """Get the current active fast"""
    try:
        active_fast = FastingPeriod.query.filter_by(
            user_id=current_user.id, 
            status='active'
        ).first()
        
        if not active_fast:
            return jsonify({'active': False})
        
        return jsonify({
            'active': True,
            'fast_id': active_fast.id,
            'start_time': active_fast.start_time.isoformat(),
            'duration': active_fast.get_duration_display(),
            'duration_minutes': active_fast.calculate_duration()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@food_bp.route('/fasting/history')
@login_required
def get_fasting_history():
    """Get fasting history"""
    try:
        # Get completed fasts, ordered by start time (newest first)
        fasts = FastingPeriod.query.filter_by(
            user_id=current_user.id,
            status='completed'
        ).order_by(FastingPeriod.start_time.desc()).limit(20).all()
        
        history = []
        for fast in fasts:
            history.append({
                'id': fast.id,
                'start_time': fast.start_time.isoformat(),
                'end_time': fast.end_time.isoformat() if fast.end_time else None,
                'duration': fast.get_duration_display(),
                'duration_minutes': fast.duration_minutes,
                'notes': fast.notes
            })
        
        return jsonify({'history': history})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@food_bp.route('/fasting/stats')
@login_required
def get_fasting_stats():
    """Get fasting statistics"""
    try:
        # Get all completed fasts
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
        total_minutes = sum(fast.duration_minutes or 0 for fast in completed_fasts)
        longest_fast = max(fast.duration_minutes or 0 for fast in completed_fasts)
        average_fast = total_minutes / total_fasts
        
        return jsonify({
            'total_fasts': total_fasts,
            'total_hours': round(total_minutes / 60, 1),
            'longest_fast': longest_fast,
            'average_fast': round(average_fast, 1)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 