#!/usr/bin/env python3
"""
Script to populate the database with workout categories and exercises
based on FitNotes data and common strength training exercises.
"""

import os
import sys
from flask import Flask
from models import db, ExerciseCategory, Exercise, init_db
from config import Config

def create_app():
    """Create Flask app for database operations."""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app

def populate_exercises():
    """Populate the database with exercise categories and exercises."""
    
    app = create_app()
    
    with app.app_context():
        # Create all tables first
        db.create_all()
        
        # Clear existing data
        Exercise.query.delete()
        ExerciseCategory.query.delete()
        
        # Create categories
        categories = {
            'Back': {
                'description': 'Back and upper body pulling movements',
                'exercises': [
                    {'name': 'Lat Pulldown', 'equipment': 'Machine', 'muscle_groups': 'Lats, Biceps'},
                    {'name': 'Longpull', 'equipment': 'Machine', 'muscle_groups': 'Lats, Upper Back'},
                    {'name': 'Pulldown (Free Weights)', 'equipment': 'Cable', 'muscle_groups': 'Lats, Biceps'},
                    {'name': 'Rows (Free Weights)', 'equipment': 'Barbell', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'Pull Up', 'equipment': 'Bodyweight', 'muscle_groups': 'Lats, Biceps'},
                    {'name': 'Dumbbell Row', 'equipment': 'Dumbbell', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'Low Row (Free Weight)', 'equipment': 'Cable', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'Barbell Row', 'equipment': 'Barbell', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'T-Bar Row', 'equipment': 'Machine', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'Seated Cable Row', 'equipment': 'Cable', 'muscle_groups': 'Upper Back, Biceps'},
                    {'name': 'Deadlift', 'equipment': 'Barbell', 'muscle_groups': 'Lower Back, Glutes, Hamstrings'},
                    {'name': 'Good Mornings', 'equipment': 'Barbell', 'muscle_groups': 'Lower Back, Hamstrings'},
                ]
            },
            'Chest': {
                'description': 'Chest and pushing movements',
                'exercises': [
                    {'name': 'Incline Dumbbell Bench Press', 'equipment': 'Dumbbell', 'muscle_groups': 'Upper Chest, Triceps'},
                    {'name': 'Chest Press', 'equipment': 'Machine', 'muscle_groups': 'Chest, Triceps'},
                    {'name': 'Dips (Chest)', 'equipment': 'Bodyweight', 'muscle_groups': 'Lower Chest, Triceps'},
                    {'name': 'Cable Fly', 'equipment': 'Cable', 'muscle_groups': 'Chest'},
                    {'name': 'Incline Press', 'equipment': 'Barbell', 'muscle_groups': 'Upper Chest, Triceps'},
                    {'name': 'Flat Barbell Bench Press', 'equipment': 'Barbell', 'muscle_groups': 'Chest, Triceps'},
                    {'name': 'Incline Barbell Bench Press', 'equipment': 'Barbell', 'muscle_groups': 'Upper Chest, Triceps'},
                    {'name': 'Pec Fly (Machine)', 'equipment': 'Machine', 'muscle_groups': 'Chest'},
                    {'name': 'Incline Dumbbell Fly', 'equipment': 'Dumbbell', 'muscle_groups': 'Upper Chest'},
                    {'name': 'Decline Bench Press', 'equipment': 'Barbell', 'muscle_groups': 'Lower Chest, Triceps'},
                    {'name': 'Push-Ups', 'equipment': 'Bodyweight', 'muscle_groups': 'Chest, Triceps'},
                    {'name': 'Dumbbell Bench Press', 'equipment': 'Dumbbell', 'muscle_groups': 'Chest, Triceps'},
                    {'name': 'Decline Dumbbell Fly', 'equipment': 'Dumbbell', 'muscle_groups': 'Lower Chest'},
                ]
            },
            'Shoulders': {
                'description': 'Shoulder and deltoid movements',
                'exercises': [
                    {'name': 'Shoulder Press', 'equipment': 'Barbell', 'muscle_groups': 'Anterior Deltoids, Triceps'},
                    {'name': 'Lateral Dumbbell Raise', 'equipment': 'Dumbbell', 'muscle_groups': 'Lateral Deltoids'},
                    {'name': 'Military Press', 'equipment': 'Barbell', 'muscle_groups': 'Anterior Deltoids, Triceps'},
                    {'name': 'Dumbbell Shoulder Press', 'equipment': 'Dumbbell', 'muscle_groups': 'Anterior Deltoids, Triceps'},
                    {'name': 'Arnold Press', 'equipment': 'Dumbbell', 'muscle_groups': 'Anterior Deltoids, Triceps'},
                    {'name': 'Front Dumbbell Raise', 'equipment': 'Dumbbell', 'muscle_groups': 'Anterior Deltoids'},
                    {'name': 'Rear Delt Fly', 'equipment': 'Dumbbell', 'muscle_groups': 'Posterior Deltoids'},
                    {'name': 'Cable Lateral Raise', 'equipment': 'Cable', 'muscle_groups': 'Lateral Deltoids'},
                    {'name': 'Upright Row', 'equipment': 'Barbell', 'muscle_groups': 'Lateral Deltoids, Traps'},
                    {'name': 'Shrugs', 'equipment': 'Barbell', 'muscle_groups': 'Traps'},
                    {'name': 'Dumbbell Shrugs', 'equipment': 'Dumbbell', 'muscle_groups': 'Traps'},
                ]
            },
            'Biceps': {
                'description': 'Bicep and arm curling movements',
                'exercises': [
                    {'name': 'Barbell Curl', 'equipment': 'Barbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Dumbbell Curl', 'equipment': 'Dumbbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Hammer Curl', 'equipment': 'Dumbbell', 'muscle_groups': 'Biceps, Forearms'},
                    {'name': 'Preacher Curl', 'equipment': 'Barbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Concentration Curl', 'equipment': 'Dumbbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Cable Curl', 'equipment': 'Cable', 'muscle_groups': 'Biceps'},
                    {'name': 'Incline Dumbbell Curl', 'equipment': 'Dumbbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Spider Curl', 'equipment': 'Barbell', 'muscle_groups': 'Biceps'},
                    {'name': '21s', 'equipment': 'Barbell', 'muscle_groups': 'Biceps'},
                    {'name': 'Zottman Curl', 'equipment': 'Dumbbell', 'muscle_groups': 'Biceps, Forearms'},
                ]
            },
            'Triceps': {
                'description': 'Tricep and arm extension movements',
                'exercises': [
                    {'name': 'V-Bar Push Down', 'equipment': 'Cable', 'muscle_groups': 'Triceps'},
                    {'name': 'Parallel Bar Triceps Dip', 'equipment': 'Bodyweight', 'muscle_groups': 'Triceps, Chest'},
                    {'name': 'Rope Push Down', 'equipment': 'Cable', 'muscle_groups': 'Triceps'},
                    {'name': 'Skull Crushers', 'equipment': 'Barbell', 'muscle_groups': 'Triceps'},
                    {'name': 'Dumbbell Tricep Extension', 'equipment': 'Dumbbell', 'muscle_groups': 'Triceps'},
                    {'name': 'Overhead Tricep Extension', 'equipment': 'Cable', 'muscle_groups': 'Triceps'},
                    {'name': 'Diamond Push-Ups', 'equipment': 'Bodyweight', 'muscle_groups': 'Triceps, Chest'},
                    {'name': 'Close-Grip Bench Press', 'equipment': 'Barbell', 'muscle_groups': 'Triceps, Chest'},
                    {'name': 'Tricep Kickback', 'equipment': 'Dumbbell', 'muscle_groups': 'Triceps'},
                    {'name': 'JM Press', 'equipment': 'Barbell', 'muscle_groups': 'Triceps'},
                ]
            },
            'Legs': {
                'description': 'Leg and lower body movements',
                'exercises': [
                    {'name': 'Barbell Squat', 'equipment': 'Barbell', 'muscle_groups': 'Quads, Glutes, Hamstrings'},
                    {'name': 'Leg Press', 'equipment': 'Machine', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Calf Raise', 'equipment': 'Machine', 'muscle_groups': 'Calves'},
                    {'name': 'Romanian Deadlift', 'equipment': 'Barbell', 'muscle_groups': 'Hamstrings, Glutes'},
                    {'name': 'Leg Extension', 'equipment': 'Machine', 'muscle_groups': 'Quads'},
                    {'name': 'Leg Curl', 'equipment': 'Machine', 'muscle_groups': 'Hamstrings'},
                    {'name': 'Hack Squat', 'equipment': 'Machine', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Lunges', 'equipment': 'Dumbbell', 'muscle_groups': 'Quads, Glutes, Hamstrings'},
                    {'name': 'Bulgarian Split Squat', 'equipment': 'Dumbbell', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Standing Calf Raise', 'equipment': 'Machine', 'muscle_groups': 'Calves'},
                    {'name': 'Seated Calf Raise', 'equipment': 'Machine', 'muscle_groups': 'Calves'},
                    {'name': 'Front Squat', 'equipment': 'Barbell', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Goblet Squat', 'equipment': 'Dumbbell', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Step-Ups', 'equipment': 'Dumbbell', 'muscle_groups': 'Quads, Glutes'},
                    {'name': 'Hip Thrust', 'equipment': 'Barbell', 'muscle_groups': 'Glutes, Hamstrings'},
                ]
            },
            'Core': {
                'description': 'Core and abdominal movements',
                'exercises': [
                    {'name': 'Plank', 'equipment': 'Bodyweight', 'muscle_groups': 'Core'},
                    {'name': 'Crunches', 'equipment': 'Bodyweight', 'muscle_groups': 'Abs'},
                    {'name': 'Russian Twists', 'equipment': 'Dumbbell', 'muscle_groups': 'Obliques'},
                    {'name': 'Leg Raises', 'equipment': 'Bodyweight', 'muscle_groups': 'Lower Abs'},
                    {'name': 'Mountain Climbers', 'equipment': 'Bodyweight', 'muscle_groups': 'Core'},
                    {'name': 'Bicycle Crunches', 'equipment': 'Bodyweight', 'muscle_groups': 'Abs, Obliques'},
                    {'name': 'Side Plank', 'equipment': 'Bodyweight', 'muscle_groups': 'Obliques'},
                    {'name': 'Dead Bug', 'equipment': 'Bodyweight', 'muscle_groups': 'Core'},
                    {'name': 'Cable Woodchop', 'equipment': 'Cable', 'muscle_groups': 'Obliques'},
                    {'name': 'Ab Wheel Rollout', 'equipment': 'Ab Wheel', 'muscle_groups': 'Core'},
                ]
            },
        }
        
        # Create categories and exercises
        for category_name, category_data in categories.items():
            category = ExerciseCategory(
                name=category_name,
                description=category_data['description']
            )
            db.session.add(category)
            db.session.flush()  # Get the ID
            
            # Add exercises for this category
            for exercise_data in category_data['exercises']:
                exercise = Exercise(
                    name=exercise_data['name'],
                    category_id=category.id,
                    description=f"{exercise_data['name']} - {exercise_data['equipment']} exercise",
                    equipment=exercise_data['equipment'],
                    muscle_groups=exercise_data['muscle_groups']
                )
                db.session.add(exercise)
        
        # Commit all changes
        db.session.commit()
        
        print(f"Successfully populated database with {len(categories)} categories and exercises!")
        
        # Print summary
        for category in ExerciseCategory.query.all():
            exercise_count = len(category.exercises)
            print(f"{category.name}: {exercise_count} exercises")

if __name__ == '__main__':
    populate_exercises() 