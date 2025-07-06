#!/usr/bin/env python3
"""
Test Food Database Script
Tests the food database functionality and shows statistics
"""

import sys
import os
from sqlalchemy import func

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import FoodReference, FoodCategory, FoodServingSize

def test_food_database():
    """Test the food database and show statistics"""
    print("🍽️ Food Database Test & Statistics")
    print("=" * 50)
    
    with app.app_context():
        # Test basic queries
        total_foods = FoodReference.query.count()
        total_categories = FoodCategory.query.count()
        total_serving_sizes = FoodServingSize.query.count()
        
        print(f"\n📊 Database Statistics:")
        print(f"   Total Foods: {total_foods}")
        print(f"   Total Categories: {total_categories}")
        print(f"   Total Serving Sizes: {total_serving_sizes}")
        
        # Show categories
        print(f"\n📂 Food Categories:")
        categories = FoodCategory.query.all()
        for category in categories:
            food_count = FoodReference.query.filter_by(category_id=category.id).count()
            print(f"   {category.name}: {food_count} foods")
        
        # Show some sample foods
        print(f"\n🍎 Sample Foods:")
        sample_foods = FoodReference.query.limit(10).all()
        for food in sample_foods:
            category_name = food.category.name if food.category else "Uncategorized"
            print(f"   {food.food_name} ({category_name}) - {food.calories} cal")
        
        # Test search functionality
        print(f"\n🔍 Search Test Results:")
        
        # Search for "apple"
        apple_foods = FoodReference.query.filter(
            FoodReference.food_name.ilike('%apple%')
        ).limit(5).all()
        print(f"   Foods containing 'apple': {len(apple_foods)}")
        for food in apple_foods:
            print(f"     - {food.food_name}")
        
        # Search for "chicken"
        chicken_foods = FoodReference.query.filter(
            FoodReference.food_name.ilike('%chicken%')
        ).limit(5).all()
        print(f"   Foods containing 'chicken': {len(chicken_foods)}")
        for food in chicken_foods:
            print(f"     - {food.food_name}")
        
        # Show nutrition statistics
        print(f"\n📈 Nutrition Statistics:")
        
        # Average calories
        avg_calories = db.session.query(func.avg(FoodReference.calories)).scalar()
        print(f"   Average Calories: {avg_calories:.1f}")
        
        # Average protein
        avg_protein = db.session.query(func.avg(FoodReference.protein)).scalar()
        print(f"   Average Protein: {avg_protein:.1f}g")
        
        # High protein foods
        high_protein = FoodReference.query.filter(
            FoodReference.protein > 20
        ).order_by(FoodReference.protein.desc()).limit(5).all()
        print(f"   Top 5 High Protein Foods:")
        for food in high_protein:
            print(f"     - {food.food_name}: {food.protein}g protein")
        
        # Low calorie foods
        low_calorie = FoodReference.query.filter(
            FoodReference.calories < 50
        ).order_by(FoodReference.calories).limit(5).all()
        print(f"   Top 5 Low Calorie Foods:")
        for food in low_calorie:
            print(f"     - {food.food_name}: {food.calories} cal")
        
        # Test serving sizes
        print(f"\n🥄 Serving Sizes Test:")
        foods_with_servings = FoodReference.query.join(FoodServingSize).limit(5).all()
        for food in foods_with_servings:
            servings = food.get_common_serving_sizes()
            print(f"   {food.food_name}: {len(servings)} serving sizes")
            for serving in servings[:3]:  # Show first 3
                print(f"     - {serving.description}")
        
        print(f"\n✅ Database test completed successfully!")
        print(f"   You can now use the food interface in the dashboard at /dashboard#food")

if __name__ == "__main__":
    test_food_database() 