#!/usr/bin/env python3
"""
Selective Food Data Import Script
Imports high-quality, commonly consumed foods from USDA FoodData Central
"""

import csv
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import pandas as pd
import gzip

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import FoodCategory, FoodReference

# Configuration
DATA_DIR = "FoodData_Central_csv_2025-04-24/FoodData_Central_csv_2025-04-24"

# Relevant food categories (by USDA category ID)
RELEVANT_CATEGORIES = {
    "0100": "Dairy and Egg Products",
    "0500": "Poultry Products", 
    "0900": "Fruits and Fruit Juices",
    "1100": "Vegetables and Vegetable Products",
    "1200": "Nut and Seed Products",
    "1300": "Beef Products",
    "1500": "Finfish and Shellfish Products",
    "1600": "Legumes and Legume Products",
    "1700": "Lamb, Veal, and Game Products",
    "2000": "Cereal Grains and Pasta",
    "1000": "Pork Products"
}

# Nutrient mapping (USDA nutrient ID -> our field name)
NUTRIENT_MAPPING = {
    "1003": "protein",           # Protein
    "1004": "fat",               # Total lipid (fat)
    "1005": "carbs",             # Carbohydrate, by difference
    "1079": "fiber",             # Fiber, total dietary
    "1063": "sugar",             # Sugars, Total
    "1093": "sodium",            # Sodium, Na
    "1087": "calcium",           # Calcium, Ca
    "1089": "iron",              # Iron, Fe
    "1092": "potassium",         # Potassium, K
    "1162": "vitamin_c",         # Vitamin C, total ascorbic acid
    "1008": "calories",          # Energy (calories)
    "1258": "saturated_fat",     # Fatty acids, total saturated
    "1257": "trans_fat",         # Fatty acids, total trans
    "1253": "cholesterol",       # Cholesterol
}

def create_food_categories(session):
    """Create food categories in our database"""
    print("Creating food categories...")
    
    # Create categories based on USDA categories
    for code, name in RELEVANT_CATEGORIES.items():
        # Check if category already exists
        existing = session.query(FoodCategory).filter_by(name=name).first()
        if not existing:
            category = FoodCategory(
                name=name,
                description=f"USDA Category: {code}",
                color="#4CAF50",  # Default green color
                icon="food"
            )
            session.add(category)
            print(f"  Created category: {name}")
    
    session.commit()
    print(f"Created {len(RELEVANT_CATEGORIES)} food categories")

def get_nutrient_value(food_nutrients, nutrient_id):
    """Extract nutrient value from food_nutrients data"""
    for nutrient in food_nutrients:
        if nutrient.get('nutrient_id') == nutrient_id:
            return float(nutrient.get('value', 0))
    return 0.0

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

def import_foundation_foods(session):
    """Import foundation foods (highest quality data)"""
    print("\nImporting foundation foods...")
    
    foundation_file = os.path.join(DATA_DIR, "foundation_food.csv")
    food_file = os.path.join(DATA_DIR, "food.csv")
    food_nutrient_file = os.path.join(DATA_DIR, "food_nutrient.csv")
    
    if not all(os.path.exists(f) for f in [foundation_file, food_file, food_nutrient_file]):
        print("Error: Required CSV files not found!")
        return
    
    # Read foundation foods
    foundation_foods = pd.read_csv(foundation_file)
    print(f"Found {len(foundation_foods)} foundation foods")
    
    # Read food descriptions (we'll need to sample this large file)
    print("Reading food descriptions...")
    food_descriptions = {}
    
    # Read only the first 10000 lines to get a sample of food descriptions
    with open(food_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 10000:  # Limit to first 10k for performance
                break
            food_descriptions[row['fdc_id']] = {
                'description': row.get('description', ''),
                'food_category_id': row.get('food_category_id', ''),
                'brand_owner': row.get('brand_owner', ''),
                'brand_name': row.get('brand_name', '')
            }
    
    # Read nutrient data (we'll need to sample this too)
    print("Reading nutrient data...")
    food_nutrients = {}
    
    with open(food_nutrient_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 50000:  # Limit to first 50k for performance
                break
            
            fdc_id = row['fdc_id']
            nutrient_id = row['nutrient_id']
            
            if fdc_id not in food_nutrients:
                food_nutrients[fdc_id] = []
            
            food_nutrients[fdc_id].append({
                'nutrient_id': nutrient_id,
                'value': row.get('value', 0)
            })
    
    # Import foundation foods
    imported_count = 0
    skipped_count = 0
    
    for _, foundation_food in foundation_foods.iterrows():
        fdc_id = str(foundation_food['fdc_id'])
        
        # Get food description
        food_info = food_descriptions.get(fdc_id, {})
        description = food_info.get('description', '')
        category_id = food_info.get('food_category_id', '')
        
        if not description:
            skipped_count += 1
            continue
        
        # Check if food already exists
        existing = session.query(FoodReference).filter_by(food_name=description).first()
        if existing:
            skipped_count += 1
            continue
        
        # Get nutrient values
        nutrients = food_nutrients.get(fdc_id, [])
        
        # Extract nutrition data
        nutrition_data = {}
        for nutrient_id, field_name in NUTRIENT_MAPPING.items():
            value = get_nutrient_value(nutrients, nutrient_id)
            nutrition_data[field_name] = value
        
        # Set default calories if not found
        if nutrition_data.get('calories', 0) == 0:
            # Estimate calories from macronutrients
            protein_cals = nutrition_data.get('protein', 0) * 4
            carb_cals = nutrition_data.get('carbs', 0) * 4
            fat_cals = nutrition_data.get('fat', 0) * 9
            nutrition_data['calories'] = protein_cals + carb_cals + fat_cals
        
        # Find matching category
        category = None
        if category_id in RELEVANT_CATEGORIES:
            category_name = RELEVANT_CATEGORIES[category_id]
            category = session.query(FoodCategory).filter_by(name=category_name).first()
        
        # Create food reference
        food_ref = FoodReference(
            food_name=clean_food_name(description),
            category_id=category.id if category else None,
            calories=nutrition_data.get('calories', 0),
            protein=nutrition_data.get('protein', 0),
            carbs=nutrition_data.get('carbs', 0),
            fat=nutrition_data.get('fat', 0),
            fiber=nutrition_data.get('fiber', 0),
            sugar=nutrition_data.get('sugar', 0),
            sodium=nutrition_data.get('sodium', 0),
            saturated_fat=nutrition_data.get('saturated_fat', 0),
            trans_fat=nutrition_data.get('trans_fat', 0),
            cholesterol=nutrition_data.get('cholesterol', 0),
            potassium=nutrition_data.get('potassium', 0),
            vitamin_c=nutrition_data.get('vitamin_c', 0),
            calcium=nutrition_data.get('calcium', 0),
            iron=nutrition_data.get('iron', 0),
            brand=food_info.get('brand_name', ''),
            serving_size="100g",
            is_verified=True,
            search_keywords=description.lower()
        )
        
        session.add(food_ref)
        imported_count += 1
        
        if imported_count % 10 == 0:
            print(f"  Imported {imported_count} foods...")
            session.commit()
    
    session.commit()
    print(f"Successfully imported {imported_count} foundation foods")
    print(f"Skipped {skipped_count} foods (already exists or no description)")

def import_common_foods(session):
    """Import additional common foods from the main food database"""
    print("\nImporting common foods from main database...")
    
    food_file = os.path.join(DATA_DIR, "food.csv")
    food_nutrient_file = os.path.join(DATA_DIR, "food_nutrient.csv")
    
    # Common food keywords to look for
    common_keywords = [
        'chicken', 'beef', 'pork', 'salmon', 'tuna', 'shrimp',
        'apple', 'banana', 'orange', 'strawberry', 'blueberry',
        'broccoli', 'spinach', 'carrot', 'tomato', 'onion',
        'rice', 'pasta', 'bread', 'oatmeal', 'quinoa',
        'milk', 'cheese', 'yogurt', 'egg',
        'almond', 'peanut', 'walnut', 'cashew'
    ]
    
    # Read food descriptions and filter by keywords
    matching_foods = []
    
    print("Searching for common foods...")
    with open(food_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 50000:  # Limit for performance
                break
            
            description = row.get('description', '').lower()
            category_id = row.get('food_category_id', '')
            
            # Check if it matches our keywords and categories
            if (any(keyword in description for keyword in common_keywords) and 
                category_id in RELEVANT_CATEGORIES):
                matching_foods.append({
                    'fdc_id': row['fdc_id'],
                    'description': row.get('description', ''),
                    'category_id': category_id,
                    'brand_owner': row.get('brand_owner', ''),
                    'brand_name': row.get('brand_name', '')
                })
    
    print(f"Found {len(matching_foods)} matching common foods")
    
    # Read nutrient data for matching foods
    food_nutrients = {}
    matching_fdc_ids = {food['fdc_id'] for food in matching_foods}
    
    with open(food_nutrient_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fdc_id = row['fdc_id']
            if fdc_id in matching_fdc_ids:
                nutrient_id = row['nutrient_id']
                
                if fdc_id not in food_nutrients:
                    food_nutrients[fdc_id] = []
                
                food_nutrients[fdc_id].append({
                    'nutrient_id': nutrient_id,
                    'value': row.get('value', 0)
                })
    
    # Import matching foods
    imported_count = 0
    skipped_count = 0
    
    for food_info in matching_foods:
        fdc_id = food_info['fdc_id']
        description = food_info['description']
        category_id = food_info['category_id']
        
        # Check if food already exists
        existing = session.query(FoodReference).filter_by(food_name=description).first()
        if existing:
            skipped_count += 1
            continue
        
        # Get nutrient values
        nutrients = food_nutrients.get(fdc_id, [])
        
        # Extract nutrition data
        nutrition_data = {}
        for nutrient_id, field_name in NUTRIENT_MAPPING.items():
            value = get_nutrient_value(nutrients, nutrient_id)
            nutrition_data[field_name] = value
        
        # Set default calories if not found
        if nutrition_data.get('calories', 0) == 0:
            protein_cals = nutrition_data.get('protein', 0) * 4
            carb_cals = nutrition_data.get('carbs', 0) * 4
            fat_cals = nutrition_data.get('fat', 0) * 9
            nutrition_data['calories'] = protein_cals + carb_cals + fat_cals
        
        # Find matching category
        category = None
        if category_id in RELEVANT_CATEGORIES:
            category_name = RELEVANT_CATEGORIES[category_id]
            category = session.query(FoodCategory).filter_by(name=category_name).first()
        
        # Create food reference
        food_ref = FoodReference(
            food_name=clean_food_name(description),
            category_id=category.id if category else None,
            calories=nutrition_data.get('calories', 0),
            protein=nutrition_data.get('protein', 0),
            carbs=nutrition_data.get('carbs', 0),
            fat=nutrition_data.get('fat', 0),
            fiber=nutrition_data.get('fiber', 0),
            sugar=nutrition_data.get('sugar', 0),
            sodium=nutrition_data.get('sodium', 0),
            saturated_fat=nutrition_data.get('saturated_fat', 0),
            trans_fat=nutrition_data.get('trans_fat', 0),
            cholesterol=nutrition_data.get('cholesterol', 0),
            potassium=nutrition_data.get('potassium', 0),
            vitamin_c=nutrition_data.get('vitamin_c', 0),
            calcium=nutrition_data.get('calcium', 0),
            iron=nutrition_data.get('iron', 0),
            brand=food_info.get('brand_name', ''),
            serving_size="100g",
            is_verified=False,  # Not foundation foods
            search_keywords=description.lower()
        )
        
        session.add(food_ref)
        imported_count += 1
        
        if imported_count % 20 == 0:
            print(f"  Imported {imported_count} common foods...")
            session.commit()
    
    session.commit()
    print(f"Successfully imported {imported_count} common foods")
    print(f"Skipped {skipped_count} foods (already exists)")

def import_openfoodfacts(session):
    """Import foods from Open Food Facts CSV (with barcode)"""
    print("\nImporting foods from Open Food Facts...")
    off_file = "en.openfoodfacts.org.products.csv.gz"
    if not os.path.exists(off_file):
        print(f"Open Food Facts file not found: {off_file}")
        return
    
    # OpenFoodFacts CSV columns of interest
    # We'll read the header to get the right indices
    with gzip.open(off_file, 'rt', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        imported_count = 0
        skipped_count = 0
        for i, row in enumerate(reader):
            if i > 100000:  # Limit for demo/performance
                break
            barcode = row.get('code', '').strip()
            name = row.get('product_name', '').strip()
            brand = row.get('brands', '').split(',')[0].strip() if row.get('brands') else ''
            category = row.get('categories', '').split(',')[0].strip() if row.get('categories') else ''
            serving_size = row.get('serving_size', '').strip() or '100g'
            # Nutrition
            try:
                calories = float(row.get('energy_100g', '') or 0) / 4.184 if row.get('energy_100g') else 0  # kJ to kcal
            except Exception:
                calories = 0
            try:
                protein = float(row.get('proteins_100g', '') or 0)
            except Exception:
                protein = 0
            try:
                carbs = float(row.get('carbohydrates_100g', '') or 0)
            except Exception:
                carbs = 0
            try:
                fat = float(row.get('fat_100g', '') or 0)
            except Exception:
                fat = 0
            try:
                fiber = float(row.get('fiber_100g', '') or 0)
            except Exception:
                fiber = 0
            try:
                sugar = float(row.get('sugars_100g', '') or 0)
            except Exception:
                sugar = 0
            try:
                sodium = float(row.get('salt_100g', '') or 0) * 400 if row.get('salt_100g') else 0  # salt to sodium mg
            except Exception:
                sodium = 0
            # Only import if barcode, name, and at least calories or protein
            if not barcode or not name or (calories == 0 and protein == 0):
                skipped_count += 1
                continue
            # Avoid duplicates by barcode or name
            exists = session.query(FoodReference).filter(
                (FoodReference.barcode == barcode) | (FoodReference.food_name == name)
            ).first()
            if exists:
                skipped_count += 1
                continue
            # Create food reference
            food_ref = FoodReference(
                food_name=name,
                brand=brand,
                category_id=None,  # Could map to your categories if desired
                calories=calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                fiber=fiber,
                sugar=sugar,
                sodium=sodium,
                serving_size=serving_size,
                barcode=barcode,
                is_verified=False,
                search_keywords=f"{name.lower()},{brand.lower()},{category.lower()}"
            )
            session.add(food_ref)
            imported_count += 1
            if imported_count % 100 == 0:
                print(f"  Imported {imported_count} Open Food Facts foods...")
                session.commit()
        session.commit()
        print(f"Successfully imported {imported_count} Open Food Facts foods")
        print(f"Skipped {skipped_count} foods (missing data or duplicate)")

def main():
    """Main import function"""
    print("=== USDA FoodData Central Selective Import ===")
    print(f"Data directory: {DATA_DIR}")
    
    if not os.path.exists(DATA_DIR):
        print(f"Error: Data directory not found: {DATA_DIR}")
        print("Please make sure you have extracted the FoodData Central CSV files.")
        return
    
    with app.app_context():
        # Create database session
        session = db.session
        
        try:
            # Create food categories
            create_food_categories(session)
            
            # Import foundation foods (highest quality)
            import_foundation_foods(session)
            
            # Import additional common foods
            import_common_foods(session)
            
            # Import Open Food Facts foods
            import_openfoodfacts(session)
            
            # Print summary
            total_foods = session.query(FoodReference).count()
            total_categories = session.query(FoodCategory).count()
            
            print(f"\n=== Import Summary ===")
            print(f"Total foods imported: {total_foods}")
            print(f"Total categories: {total_categories}")
            print(f"Import completed successfully!")
            
        except Exception as e:
            print(f"Error during import: {e}")
            session.rollback()
            raise
        finally:
            session.close()

if __name__ == "__main__":
    main() 