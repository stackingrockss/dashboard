#!/usr/bin/env python3
"""
Test script for workout template functionality
"""

import requests
import json
from datetime import datetime

# Base URL for the Flask app
BASE_URL = "http://localhost:5000"

def test_workout_templates():
    """Test workout template API endpoints"""
    
    print("=== Testing Workout Template Functionality ===\n")
    
    # Test 1: Get workout templates (should be empty initially)
    print("1. Testing GET /fitness/api/workout_templates")
    try:
        response = requests.get(f"{BASE_URL}/fitness/api/workout_templates")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            templates = response.json()
            print(f"Found {len(templates)} templates")
            for template in templates:
                print(f"  - {template['name']} ({template['exercise_count']} exercises)")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Test 2: Create a sample workout template
    print("2. Testing POST /fitness/api/workout_templates")
    sample_template = {
        "name": "Sample Push Day",
        "description": "A sample push workout template",
        "notes": "Test template created by script",
        "is_public": False,
        "exercises": [
            {
                "exercise_name": "Bench Press",
                "exercise_id": 1,
                "order": 1
            },
            {
                "exercise_name": "Push-ups",
                "exercise_id": 2,
                "order": 2
            },
            {
                "exercise_name": "Overhead Press",
                "exercise_id": 3,
                "order": 3
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/fitness/api/workout_templates",
            json=sample_template,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 201:
            result = response.json()
            print(f"Template created successfully!")
            print(f"Template ID: {result['template']['id']}")
            print(f"Template Name: {result['template']['name']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Test 3: Get workout templates again (should now have the sample)
    print("3. Testing GET /fitness/api/workout_templates (after creation)")
    try:
        response = requests.get(f"{BASE_URL}/fitness/api/workout_templates")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            templates = response.json()
            print(f"Found {len(templates)} templates")
            for template in templates:
                print(f"  - {template['name']} ({template['exercise_count']} exercises)")
                print(f"    Created: {template['created_at']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Test 4: Get specific template details
    if response.status_code == 200 and len(response.json()) > 0:
        template_id = response.json()[0]['id']
        print(f"4. Testing GET /fitness/api/workout_templates/{template_id}")
        try:
            response = requests.get(f"{BASE_URL}/fitness/api/workout_templates/{template_id}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                template = response.json()
                print(f"Template: {template['name']}")
                print(f"Exercises: {len(template['exercises'])}")
                for exercise in template['exercises']:
                    print(f"  - {exercise['exercise_name']} (Order: {exercise['order']})")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Error: {e}")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    test_workout_templates() 