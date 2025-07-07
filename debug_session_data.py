#!/usr/bin/env python3
"""
Debug script to check session data structure
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import WorkoutSession, WorkoutSessionExercise

def debug_session_data():
    """Debug session data structure"""
    with app.app_context():
        print("=== DEBUGGING SESSION DATA ===")
        
        # Get session 7 (which has Dumbbell Curl exercises)
        session = WorkoutSession.query.get(7)
        if not session:
            print("Session 7 not found")
            return
            
        print(f"Session ID: {session.id}")
        print(f"Session Name: {session.name}")
        print(f"Session Date: {session.date}")
        print(f"Session Status: {session.status}")
        
        print(f"\nSession has {len(session.exercises)} exercises:")
        
        for i, exercise in enumerate(session.exercises):
            print(f"\nExercise {i+1}:")
            print(f"  Session Exercise ID: {exercise.id}")
            print(f"  Exercise ID: {exercise.exercise_id}")
            print(f"  Exercise Name: {exercise.exercise_name}")
            print(f"  Category ID: {exercise.category_id}")
            print(f"  Order: {exercise.order}")
            print(f"  Completed: {exercise.completed}")
            
            # This is what the JavaScript would see
            exercise_data = {
                'id': exercise.id,
                'exercise_name': exercise.exercise_name,
                'exercise_id': exercise.exercise_id,
                'category_id': exercise.category_id,
                'order': exercise.order,
                'notes': exercise.notes,
                'target_sets': exercise.target_sets,
                'target_reps': exercise.target_reps,
                'target_weight': exercise.target_weight,
                'rest_time': exercise.rest_time,
                'completed': exercise.completed
            }
            print(f"  JavaScript would see: {exercise_data}")

if __name__ == '__main__':
    debug_session_data() 