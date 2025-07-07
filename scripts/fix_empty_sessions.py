#!/usr/bin/env python3
"""
Script to fix workout sessions that have no exercises but have a template_id.
This will populate the exercises from the template.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import WorkoutSession, WorkoutTemplate, WorkoutSessionExercise

def fix_empty_sessions():
    """Find and fix sessions with no exercises but have a template_id"""
    with app.app_context():
        # Find sessions with no exercises but have a template_id
        empty_sessions = db.session.query(WorkoutSession).filter(
            ~WorkoutSession.exercises.any(),
            WorkoutSession.template_id.isnot(None)
        ).all()
        
        print(f"Found {len(empty_sessions)} sessions with no exercises but have template_id")
        
        fixed_count = 0
        for session in empty_sessions:
            print(f"\nProcessing session: {session.name} (ID: {session.id})")
            
            # Get the template
            template = WorkoutTemplate.query.get(session.template_id)
            if not template:
                print(f"  Template {session.template_id} not found, skipping")
                continue
            
            print(f"  Template: {template.name}")
            print(f"  Template has {len(template.exercises)} exercises")
            
            # Copy exercises from template
            for template_exercise in template.exercises:
                session_exercise = WorkoutSessionExercise(
                    session_id=session.id,
                    exercise_name=template_exercise.exercise_name,
                    exercise_id=template_exercise.exercise_id,
                    category_id=template_exercise.category_id,
                    order=template_exercise.order,
                    notes=template_exercise.notes,
                    target_sets=template_exercise.target_sets,
                    target_reps=template_exercise.target_reps,
                    target_weight=template_exercise.target_weight,
                    rest_time=template_exercise.rest_time
                )
                db.session.add(session_exercise)
                print(f"    Added exercise: {template_exercise.exercise_name}")
            
            fixed_count += 1
        
        if fixed_count > 0:
            db.session.commit()
            print(f"\nFixed {fixed_count} sessions!")
        else:
            print("\nNo sessions needed fixing.")

if __name__ == '__main__':
    fix_empty_sessions() 