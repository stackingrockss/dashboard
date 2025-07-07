#!/usr/bin/env python3
"""
Script to fix workout session exercises that have null category_id.
This will look up the category_id from the Exercise model based on exercise_id.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import WorkoutSessionExercise, Exercise

def fix_category_ids():
    """Find and fix session exercises with null category_id"""
    with app.app_context():
        # Find session exercises with null category_id but have exercise_id
        null_category_exercises = db.session.query(WorkoutSessionExercise).filter(
            WorkoutSessionExercise.category_id.is_(None),
            WorkoutSessionExercise.exercise_id.isnot(None)
        ).all()
        
        print(f"Found {len(null_category_exercises)} session exercises with null category_id")
        
        fixed_count = 0
        for session_exercise in null_category_exercises:
            print(f"\nProcessing exercise: {session_exercise.exercise_name} (ID: {session_exercise.id})")
            
            # Get the exercise to find its category_id
            exercise = Exercise.query.get(session_exercise.exercise_id)
            if not exercise:
                print(f"  Exercise {session_exercise.exercise_id} not found, skipping")
                continue
            
            if exercise.category_id:
                session_exercise.category_id = exercise.category_id
                print(f"  Updated category_id to {exercise.category_id}")
                fixed_count += 1
            else:
                print(f"  Exercise has no category_id, skipping")
        
        if fixed_count > 0:
            db.session.commit()
            print(f"\nFixed {fixed_count} session exercises!")
        else:
            print("\nNo session exercises needed fixing.")

if __name__ == '__main__':
    fix_category_ids() 