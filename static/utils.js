export function showSnack(message, type = 'success') {
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar ${type}`;
    snackbar.textContent = message;
    document.body.appendChild(snackbar);
    setTimeout(() => {
        snackbar.remove();
    }, 3000);
}

export function clean_nutrient_value(value) {
    if (value === null || value === undefined || ['N/A', '--', ''].includes(String(value).trim())) {
        return null;
    }
    try {
        return parseFloat(String(value).replace(',', ''));
    } catch {
        return 0.0;
    }
}

export function convert_units(quantity, from_unit, to_unit) {
    const conversions = {
        'g': 1.0,
        'oz': 28.3495,
        'ml': 1.0,
        'serving': 1.0
    };
    const numeric_match = /(\d+\.?\d*)\s*(g|ml|oz|bar|piece|s)/i.exec(from_unit);
    const from_multiplier = numeric_match ? parseFloat(numeric_match[1]) : 1.0;
    const from_base_unit = numeric_match ? numeric_match[2].toLowerCase() : from_unit.toLowerCase();
    if (!(from_base_unit in conversions) || !(to_unit in conversions)) {
        return quantity;
    }
    const grams = quantity * from_multiplier * conversions[from_base_unit];
    const scaled_quantity = grams / conversions[to_unit];
    return scaled_quantity;
}