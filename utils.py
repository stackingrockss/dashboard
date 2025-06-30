import re

def clean_nutrient_value(value):
    if value is None or str(value).strip() in ('N/A', '--', ''):
        return None
    try:
        return float(str(value).replace(',', ''))
    except ValueError:
        return 0.0

def convert_units(quantity, from_unit, to_unit):
    """Convert quantity between units (e.g., grams to ounces). Returns scaling factor."""
    conversions = {
        'g': 1.0,
        'oz': 28.3495,
        'ml': 1.0,
        'serving': 1.0
    }
    numeric_match = re.match(r'(\d+\.?\d*)\s*(g|ml|oz|bar|piece|s)', from_unit, re.IGNORECASE)
    from_multiplier = float(numeric_match.group(1)) if numeric_match else 1.0
    from_base_unit = numeric_match.group(2).lower() if numeric_match else from_unit.lower()
    if from_base_unit not in conversions or to_unit not in conversions:
        return quantity
    grams = quantity * from_multiplier * conversions[from_base_unit]
    scaled_quantity = grams / conversions[to_unit]
    return scaled_quantity