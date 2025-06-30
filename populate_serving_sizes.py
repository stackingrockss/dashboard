#!/usr/bin/env python3
"""
Script to populate common serving sizes for foods in the database.
This will add realistic serving sizes for different types of foods.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, FoodReference, FoodServingSize, FoodCategory
from sqlalchemy import text

def populate_serving_sizes():
    """Populate common serving sizes for foods"""
    with app.app_context():
        print("Populating serving sizes for foods...")
        
        # Get all foods
        foods = FoodReference.query.all()
        print(f"Found {len(foods)} foods to process")
        
        # Common serving size mappings for different food types
        serving_size_mappings = {
            # Fruits
            'apple': [
                {'description': '1 medium apple', 'amount': 1, 'unit': 'medium', 'grams': 182, 'is_common': True, 'is_default': True},
                {'description': '1 large apple', 'amount': 1, 'unit': 'large', 'grams': 242, 'is_common': True, 'is_default': False},
                {'description': '1 cup sliced', 'amount': 1, 'unit': 'cup', 'grams': 109, 'is_common': True, 'is_default': False},
            ],
            'banana': [
                {'description': '1 medium banana', 'amount': 1, 'unit': 'medium', 'grams': 118, 'is_common': True, 'is_default': True},
                {'description': '1 large banana', 'amount': 1, 'unit': 'large', 'grams': 136, 'is_common': True, 'is_default': False},
                {'description': '1 cup sliced', 'amount': 1, 'unit': 'cup', 'grams': 150, 'is_common': True, 'is_default': False},
            ],
            'orange': [
                {'description': '1 medium orange', 'amount': 1, 'unit': 'medium', 'grams': 131, 'is_common': True, 'is_default': True},
                {'description': '1 large orange', 'amount': 1, 'unit': 'large', 'grams': 184, 'is_common': True, 'is_default': False},
            ],
            
            # Vegetables
            'carrot': [
                {'description': '1 medium carrot', 'amount': 1, 'unit': 'medium', 'grams': 61, 'is_common': True, 'is_default': True},
                {'description': '1 cup chopped', 'amount': 1, 'unit': 'cup', 'grams': 128, 'is_common': True, 'is_default': False},
            ],
            'broccoli': [
                {'description': '1 cup chopped', 'amount': 1, 'unit': 'cup', 'grams': 91, 'is_common': True, 'is_default': True},
                {'description': '1 medium head', 'amount': 1, 'unit': 'head', 'grams': 148, 'is_common': True, 'is_default': False},
            ],
            'spinach': [
                {'description': '1 cup raw', 'amount': 1, 'unit': 'cup', 'grams': 30, 'is_common': True, 'is_default': True},
                {'description': '1 cup cooked', 'amount': 1, 'unit': 'cup', 'grams': 180, 'is_common': True, 'is_default': False},
            ],
            
            # Grains
            'rice': [
                {'description': '1 cup cooked', 'amount': 1, 'unit': 'cup', 'grams': 195, 'is_common': True, 'is_default': True},
                {'description': '1/2 cup cooked', 'amount': 0.5, 'unit': 'cup', 'grams': 98, 'is_common': True, 'is_default': False},
            ],
            'bread': [
                {'description': '1 slice', 'amount': 1, 'unit': 'slice', 'grams': 30, 'is_common': True, 'is_default': True},
                {'description': '2 slices', 'amount': 2, 'unit': 'slice', 'grams': 60, 'is_common': True, 'is_default': False},
            ],
            'pasta': [
                {'description': '1 cup cooked', 'amount': 1, 'unit': 'cup', 'grams': 200, 'is_common': True, 'is_default': True},
                {'description': '1/2 cup cooked', 'amount': 0.5, 'unit': 'cup', 'grams': 100, 'is_common': True, 'is_default': False},
            ],
            
            # Proteins
            'chicken': [
                {'description': '3 oz cooked', 'amount': 3, 'unit': 'oz', 'grams': 85, 'is_common': True, 'is_default': True},
                {'description': '4 oz cooked', 'amount': 4, 'unit': 'oz', 'grams': 113, 'is_common': True, 'is_default': False},
                {'description': '1 breast', 'amount': 1, 'unit': 'breast', 'grams': 174, 'is_common': True, 'is_default': False},
            ],
            'salmon': [
                {'description': '3 oz cooked', 'amount': 3, 'unit': 'oz', 'grams': 85, 'is_common': True, 'is_default': True},
                {'description': '4 oz cooked', 'amount': 4, 'unit': 'oz', 'grams': 113, 'is_common': True, 'is_default': False},
            ],
            'egg': [
                {'description': '1 large egg', 'amount': 1, 'unit': 'large', 'grams': 50, 'is_common': True, 'is_default': True},
                {'description': '2 large eggs', 'amount': 2, 'unit': 'large', 'grams': 100, 'is_common': True, 'is_default': False},
            ],
            
            # Dairy
            'milk': [
                {'description': '1 cup', 'amount': 1, 'unit': 'cup', 'grams': 244, 'is_common': True, 'is_default': True},
                {'description': '1/2 cup', 'amount': 0.5, 'unit': 'cup', 'grams': 122, 'is_common': True, 'is_default': False},
            ],
            'yogurt': [
                {'description': '1 cup', 'amount': 1, 'unit': 'cup', 'grams': 245, 'is_common': True, 'is_default': True},
                {'description': '1/2 cup', 'amount': 0.5, 'unit': 'cup', 'grams': 123, 'is_common': True, 'is_default': False},
            ],
            'cheese': [
                {'description': '1 oz', 'amount': 1, 'unit': 'oz', 'grams': 28, 'is_common': True, 'is_default': True},
                {'description': '1/4 cup shredded', 'amount': 0.25, 'unit': 'cup', 'grams': 28, 'is_common': True, 'is_default': False},
            ],
            
            # Nuts and seeds
            'almond': [
                {'description': '1 oz', 'amount': 1, 'unit': 'oz', 'grams': 28, 'is_common': True, 'is_default': True},
                {'description': '1/4 cup', 'amount': 0.25, 'unit': 'cup', 'grams': 35, 'is_common': True, 'is_default': False},
            ],
            'peanut': [
                {'description': '1 oz', 'amount': 1, 'unit': 'oz', 'grams': 28, 'is_common': True, 'is_default': True},
                {'description': '1/4 cup', 'amount': 0.25, 'unit': 'cup', 'grams': 36, 'is_common': True, 'is_default': False},
            ],
        }
        
        # Generic serving sizes for foods not in the mapping
        generic_servings = [
            {'description': '100g', 'amount': 100, 'unit': 'g', 'grams': 100, 'is_common': True, 'is_default': True},
            {'description': '1 cup', 'amount': 1, 'unit': 'cup', 'grams': 240, 'is_common': True, 'is_default': False},
            {'description': '1/2 cup', 'amount': 0.5, 'unit': 'cup', 'grams': 120, 'is_common': True, 'is_default': False},
            {'description': '1 tbsp', 'amount': 1, 'unit': 'tbsp', 'grams': 15, 'is_common': True, 'is_default': False},
        ]
        
        added_count = 0
        skipped_count = 0
        
        for food in foods:
            food_name_lower = food.food_name.lower()
            
            # Check if we have specific serving sizes for this food
            found_mapping = False
            for key, servings in serving_size_mappings.items():
                if key in food_name_lower:
                    found_mapping = True
                    for serving_data in servings:
                        # Check if serving size already exists
                        existing = FoodServingSize.query.filter_by(
                            food_id=food.id,
                            description=serving_data['description']
                        ).first()
                        
                        if not existing:
                            serving = FoodServingSize(
                                food_id=food.id,
                                description=serving_data['description'],
                                amount=serving_data['amount'],
                                unit=serving_data['unit'],
                                grams_equivalent=serving_data['grams'],
                                is_common=serving_data['is_common'],
                                is_default=serving_data['is_default']
                            )
                            db.session.add(serving)
                            added_count += 1
                        else:
                            skipped_count += 1
                    break
            
            # If no specific mapping found, add generic servings
            if not found_mapping:
                for serving_data in generic_servings:
                    # Check if serving size already exists
                    existing = FoodServingSize.query.filter_by(
                        food_id=food.id,
                        description=serving_data['description']
                    ).first()
                    
                    if not existing:
                        serving = FoodServingSize(
                            food_id=food.id,
                            description=serving_data['description'],
                            amount=serving_data['amount'],
                            unit=serving_data['unit'],
                            grams_equivalent=serving_data['grams'],
                            is_common=serving_data['is_common'],
                            is_default=serving_data['is_default']
                        )
                        db.session.add(serving)
                        added_count += 1
                    else:
                        skipped_count += 1
        
        # Commit all changes
        try:
            db.session.commit()
            print(f"Successfully added {added_count} serving sizes")
            print(f"Skipped {skipped_count} existing serving sizes")
            print("Serving size population completed!")
            
        except Exception as e:
            db.session.rollback()
            print(f"Error committing serving sizes: {e}")
            return False
        
        return True

if __name__ == "__main__":
    populate_serving_sizes() 