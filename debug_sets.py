#!/usr/bin/env python3
"""
Debug script to check session exercises and their data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import WorkoutSessionExercise, Workout, WorkoutSession

def debug_sets():
    """Debug session exercises and sets"""
    with app.app_context():
        print("=== DEBUGGING SESSION EXERCISES ===")
        
        # Get all session exercises
        session_exercises = WorkoutSessionExercise.query.all()
        print(f"Found {len(session_exercises)} session exercises")
        
        for se in session_exercises:
            print(f"\nSession Exercise ID: {se.id}")
            print(f"  Session ID: {se.session_id}")
            print(f"  Exercise ID: {se.exercise_id}")
            print(f"  Exercise Name: {se.exercise_name}")
            print(f"  Category ID: {se.category_id}")
            print(f"  Order: {se.order}")
        
        print("\n=== DEBUGGING TODAY'S WORKOUTS ===")
        from datetime import datetime
        today = datetime.now().date()
        
        workouts = Workout.query.filter_by(date=today).all()
        print(f"Found {len(workouts)} workouts for today ({today})")
        
        for w in workouts:
            print(f"\nWorkout ID: {w.id}")
            print(f"  Exercise: {w.exercise}")
            print(f"  Weight: {w.weight}")
            print(f"  Reps: {w.reps}")
            print(f"  Sets: {w.sets}")
            print(f"  Date: {w.date}")
        
        # Test the API logic
        print("\n=== TESTING API LOGIC ===")
        if session_exercises:
            se = session_exercises[0]
            print(f"Testing with session exercise: {se.exercise_name}")
            print(f"  Session ID: {se.session_id}")
            print(f"  Exercise ID: {se.exercise_id}")
            
            # Try to find session exercise by exercise_id
            found_se = WorkoutSessionExercise.query.filter_by(
                session_id=se.session_id,
                exercise_id=se.exercise_id
            ).first()
            
            if found_se:
                print(f"  Found session exercise by exercise_id: {found_se.exercise_name}")
            else:
                print(f"  NOT FOUND by exercise_id")
                
                # Try by exercise name
                found_se = WorkoutSessionExercise.query.filter_by(
                    session_id=se.session_id,
                    exercise_name=se.exercise_name
                ).first()
                
                if found_se:
                    print(f"  Found session exercise by exercise_name: {found_se.exercise_name}")
                else:
                    print(f"  NOT FOUND by exercise_name either")

if __name__ == '__main__':
    debug_sets() 