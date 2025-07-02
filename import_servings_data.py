#!/usr/bin/env python3
"""
Import Servings Data Script
Imports food data from servings.csv into the food database
"""

import csv
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import pandas as pd

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import FoodCategory, FoodReference, FoodServingSize

def clean_food_name(name):
    """Clean and standardize food names"""
    if not name:
        return ""
    
    # Remove common prefixes/suffixes
    name = name.replace("USDA Commodity, ", "")
    name = name.replace(", USDA Commodity", "")
    name = name.replace(", raw", "")
    name = name.replace(", cooked", "")
    name = name.replace(", boiled", "")
    name = name.replace(", roasted", "")
    name = name.replace(", grilled", "")
    
    # Capitalize properly
    name = name.title()
    
    return name.strip()

def parse_serving_amount(amount_str):
    """Parse serving amount string to extract amount and unit"""
    if not amount_str:
        return 100, "g"
    
    amount_str = str(amount_str).strip()
    
    # Handle common patterns
    if "g" in amount_str:
        # Extract number before "g"
        try:
            amount = float(amount_str.replace("g", "").strip())
            return amount, "g"
        except:
            pass
    
    if "oz" in amount_str:
        # Extract number before "oz"
        try:
            amount = float(amount_str.replace("oz", "").strip())
            return amount, "oz"
        except:
            pass
    
    if "cup" in amount_str:
        # Extract number before "cup"
        try:
            amount = float(amount_str.replace("cup", "").replace("cups", "").strip())
            return amount, "cup"
        except:
            pass
    
    if "tbsp" in amount_str:
        # Extract number before "tbsp"
        try:
            amount = float(amount_str.replace("tbsp", "").strip())
            return amount, "tbsp"
        except:
            pass
    
    if "tsp" in amount_str:
        # Extract number before "tsp"
        try:
            amount = float(amount_str.replace("tsp", "").strip())
            return amount, "tsp"
        except:
            pass
    
    # Try to extract any number
    import re
    numbers = re.findall(r'\d+\.?\d*', amount_str)
    if numbers:
        try:
            amount = float(numbers[0])
            return amount, "serving"
        except:
            pass
    
    # Default
    return 100, "g"

def create_categories_from_servings(session):
    """Create food categories based on the Category column in servings.csv"""
    print("Creating food categories from servings data...")
    
    # Read the CSV to get unique categories
    categories = set()
    with open('servings_fulldata.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            category = row.get('Category', '').strip()
            if category:
                categories.add(category)
    
    # Create categories
    category_map = {}
    for category_name in categories:
        if category_name:
            # Check if category already exists
            existing = session.query(FoodCategory).filter_by(name=category_name).first()
            if not existing:
                category = FoodCategory(
                    name=category_name,
                    description=f"Category from servings data",
                    color="#4CAF50",  # Default green color
                    icon="food"
                )
                session.add(category)
                session.commit()
                print(f"  Created category: {category_name}")
            
            category_map[category_name] = session.query(FoodCategory).filter_by(name=category_name).first()
    
    print(f"Created {len(categories)} food categories")

def import_servings_data(session):
    """Import unique foods from servings.csv"""
    print("\nImporting foods from servings.csv...")
    
    if not os.path.exists('servings_fulldata.csv'):
        print("Error: servings_fulldata.csv not found!")
        return
    
    # Read the CSV file
    df = pd.read_csv('servings_fulldata.csv')
    
    # Group by food name to get unique foods
    unique_foods = df.groupby('Food Name').agg({
        'Energy (kcal)': 'first',
        'Protein (g)': 'first',
        'Carbs (g)': 'first',
        'Fat (g)': 'first',
        'Fiber (g)': 'first',
        'Sugars (g)': 'first',
        'Sodium (mg)': 'first',
        'Saturated (g)': 'first',
        'Trans-Fats (g)': 'first',
        'Cholesterol (mg)': 'first',
        'Potassium (mg)': 'first',
        'Vitamin C (mg)': 'first',
        'Calcium (mg)': 'first',
        'Iron (mg)': 'first',
        'Category': 'first',
        'Amount': 'first'
    }).reset_index()
    
    print(f"Found {len(unique_foods)} unique foods")
    
    imported_count = 0
    skipped_count = 0
    
    for _, food_data in unique_foods.iterrows():
        food_name = food_data['Food Name']
        category_name = food_data.get('Category', '')
        
        # Clean food name
        clean_name = clean_food_name(food_name)
        if not clean_name:
            skipped_count += 1
            continue
        
        # Check if food already exists
        existing = session.query(FoodReference).filter_by(food_name=clean_name).first()
        if existing:
            skipped_count += 1
            continue
        
        # Find category
        category = None
        if category_name:
            category = session.query(FoodCategory).filter_by(name=category_name).first()
        
        # Parse serving amount
        amount_str = food_data.get('Amount', '100g')
        amount, unit = parse_serving_amount(amount_str)
        
        # Convert to 100g basis for nutrition values
        multiplier = 100.0 / amount if amount > 0 else 1.0
        
        # Create food reference with proper null handling
        food_ref = FoodReference(
            food_name=clean_name,
            category_id=category.id if category else None,
            calories=float(food_data.get('Energy (kcal)', 0) or 0) * multiplier,
            protein=float(food_data.get('Protein (g)', 0) or 0) * multiplier,
            carbs=float(food_data.get('Carbs (g)', 0) or 0) * multiplier,
            fat=float(food_data.get('Fat (g)', 0) or 0) * multiplier,
            fiber=float(food_data.get('Fiber (g)', 0) or 0) * multiplier,
            sugar=float(food_data.get('Sugars (g)', 0) or 0) * multiplier,
            sodium=float(food_data.get('Sodium (mg)', 0) or 0) * multiplier,
            saturated_fat=float(food_data.get('Saturated (g)', 0) or 0) * multiplier,
            trans_fat=float(food_data.get('Trans-Fats (g)', 0) or 0) * multiplier,
            cholesterol=float(food_data.get('Cholesterol (mg)', 0) or 0) * multiplier,
            potassium=float(food_data.get('Potassium (mg)', 0) or 0) * multiplier,
            vitamin_c=float(food_data.get('Vitamin C (mg)', 0) or 0) * multiplier,
            calcium=float(food_data.get('Calcium (mg)', 0) or 0) * multiplier,
            iron=float(food_data.get('Iron (mg)', 0) or 0) * multiplier,
            brand="",  # Extract brand from name if possible
            serving_size="100g",
            is_verified=False,  # User-provided data
            search_keywords=clean_name.lower()
        )
        
        session.add(food_ref)
        session.flush()  # Get the ID
        
        # Create serving size entry
        serving_size = FoodServingSize(
            food_id=food_ref.id,
            description=amount_str,
            amount=amount,
            unit=unit,
            grams_equivalent=amount if unit == 'g' else amount * 28.35 if unit == 'oz' else amount * 100,  # Rough conversion
            is_common=True,
            is_default=True
        )
        
        session.add(serving_size)
        imported_count += 1
        
        if imported_count % 10 == 0:
            print(f"  Imported {imported_count} foods...")
            session.commit()
    
    session.commit()
    print(f"Successfully imported {imported_count} foods from servings.csv")
    print(f"Skipped {skipped_count} foods (already exists or invalid)")

def main():
    """Main function to run the import"""
    print("Starting servings data import...")
    
    with app.app_context():
        # Create categories
        create_categories_from_servings(db.session)
        
        # Import foods
        import_servings_data(db.session)
        
        print("\nImport completed successfully!")

if __name__ == "__main__":
    main() 