#!/usr/bin/env python3
"""
Test script to test the exercise_sets API endpoint
"""

import requests
import json

def test_exercise_sets_api():
    """Test the exercise_sets API endpoint"""
    
    # Test with session 7, exercise_id 38 (Dumbbell Curl)
    url = "http://localhost:5000/fitness/api/exercise_sets"
    params = {
        'exercise_id': '38',
        'session_id': '7',
        'exercise_name': 'Dumbbell Curl'
    }
    
    print(f"Testing API with params: {params}")
    
    try:
        response = requests.get(url, params=params)
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response data: {json.dumps(data, indent=2)}")
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error testing API: {e}")

if __name__ == '__main__':
    test_exercise_sets_api() 