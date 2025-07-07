from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from flask import Flask

# Initialize SQLAlchemy instance
db = SQLAlchemy()

def init_db(app: Flask):
    """Create all database tables within the Flask app context."""
    with app.app_context():
        db.create_all()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    username = db.Column(db.String(80), unique=True, nullable=True)  # New username field
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    weight = db.Column(db.Float)  # in pounds
    height = db.Column(db.Float)  # in inches
    age = db.Column(db.Integer)
    sex = db.Column(db.String(10))  # Male, Female
    birthdate = db.Column(db.Date, nullable=True)  # New field
    
    # Relationships
    stats = db.relationship('Stat', backref='user', lazy=True, cascade='all, delete-orphan')
    food_entries = db.relationship('FoodEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    workouts = db.relationship('Workout', backref='user', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('Activity', backref='user', lazy=True, cascade='all, delete-orphan')
    tdee_records = db.relationship('TDEE', backref='user', lazy=True, cascade='all, delete-orphan')
    moods = db.relationship('Mood', backref='user', lazy=True, cascade='all, delete-orphan')
    workout_templates = db.relationship('WorkoutTemplate', backref='user', lazy=True, cascade='all, delete-orphan')
    workout_sessions = db.relationship('WorkoutSession', backref='user', lazy=True, cascade='all, delete-orphan')
    settings = db.relationship('UserSettings', backref='user', lazy=True, uselist=False, cascade='all, delete-orphan')
    
    # Relationship to favorite exercises
    favorite_exercises = db.relationship('Exercise', secondary='user_favorite_exercise')

class Stat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    weight = db.Column(db.Float, nullable=True)  # in pounds
    height = db.Column(db.Float, nullable=True)  # in inches
    age = db.Column(db.Integer, nullable=True)
    sex = db.Column(db.String(10), nullable=True)  # Male, Female
    body_fat_percentage = db.Column(db.Float, nullable=True)  # in percentage
    resting_heart_rate = db.Column(db.Integer, nullable=True)  # in bpm
    bicep_measurement = db.Column(db.Float, nullable=True)  # in inches
    chest_measurement = db.Column(db.Float, nullable=True)  # in inches
    waist_measurement = db.Column(db.Float, nullable=True)  # in inches
    butt_measurement = db.Column(db.Float, nullable=True)  # in inches
    quad_measurement = db.Column(db.Float, nullable=True)  # in inches
    
    # New InBody Metrics
    smm = db.Column(db.Float, nullable=True)  # Skeletal Muscle Mass
    body_fat_mass = db.Column(db.Float, nullable=True)
    lean_body_mass = db.Column(db.Float, nullable=True)
    bmr = db.Column(db.Integer, nullable=True)  # Basal Metabolic Rate
    
    # Segmental Lean Analysis
    left_arm_lean_mass = db.Column(db.Float, nullable=True)
    right_arm_lean_mass = db.Column(db.Float, nullable=True)
    left_leg_lean_mass = db.Column(db.Float, nullable=True)
    right_leg_lean_mass = db.Column(db.Float, nullable=True)
    trunk_lean_mass = db.Column(db.Float, nullable=True)
    
    # Body Scan Image
    bodyscan_image_path = db.Column(db.String(255), nullable=True)

class FoodCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(200), nullable=True)
    color = db.Column(db.String(7), nullable=True)  # Hex color code
    icon = db.Column(db.String(50), nullable=True)  # Icon class name
    
    # Relationship to foods
    foods = db.relationship('FoodReference', backref='category', lazy=True, cascade='all, delete-orphan')

class FoodServingSize(db.Model):
    """Model for storing multiple serving sizes for foods"""
    id = db.Column(db.Integer, primary_key=True)
    food_id = db.Column(db.Integer, db.ForeignKey('food_reference.id'), nullable=False)
    
    # Serving size information
    description = db.Column(db.String(100), nullable=False)  # e.g., "1 slice", "1 cup", "1 medium apple"
    amount = db.Column(db.Float, nullable=False)  # Numeric amount
    unit = db.Column(db.String(20), nullable=False)  # e.g., "slice", "cup", "piece", "g", "oz"
    grams_equivalent = db.Column(db.Float, nullable=False)  # Weight in grams for calculations
    
    # Metadata
    is_common = db.Column(db.Boolean, default=False)  # Is this a commonly used serving size?
    is_default = db.Column(db.Boolean, default=False)  # Is this the default serving size?
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship - remove cascade to fix the error
    food = db.relationship('FoodReference', backref='serving_sizes', lazy=True)
    
    __table_args__ = (db.UniqueConstraint('food_id', 'description', name='uix_food_serving_size'),)

class FoodReference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    food_name = db.Column(db.String(100), nullable=False, unique=True)
    category_id = db.Column(db.Integer, db.ForeignKey('food_category.id'), nullable=True)
    
    # Basic nutrition per 100g
    calories = db.Column(db.Float, nullable=False)
    protein = db.Column(db.Float, nullable=True)
    carbs = db.Column(db.Float, nullable=True)
    fat = db.Column(db.Float, nullable=True)
    fiber = db.Column(db.Float, nullable=True)
    sugar = db.Column(db.Float, nullable=True)
    sodium = db.Column(db.Float, nullable=True)
    
    # Additional nutrition info
    saturated_fat = db.Column(db.Float, nullable=True)
    trans_fat = db.Column(db.Float, nullable=True)
    cholesterol = db.Column(db.Float, nullable=True)
    potassium = db.Column(db.Float, nullable=True)
    vitamin_c = db.Column(db.Float, nullable=True)
    calcium = db.Column(db.Float, nullable=True)
    iron = db.Column(db.Float, nullable=True)
    
    # Metadata
    brand = db.Column(db.String(100), nullable=True)
    serving_size = db.Column(db.String(50), nullable=True)  # e.g., "1 cup", "100g" - legacy field
    is_verified = db.Column(db.Boolean, default=False)  # Admin verified data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Search optimization
    search_keywords = db.Column(db.Text, nullable=True)  # Comma-separated keywords for better search
    
    # New barcode field
    barcode = db.Column(db.String(32), nullable=True, unique=True)  # UPC/EAN barcode
    
    # Common units for this food
    common_units = db.Column(db.Text, nullable=True)  # JSON string of common units like ["slice", "cup", "piece"]
    
    def get_nutrition_for_serving(self, serving_size_id=None, amount=100, unit='g'):
        """Get nutrition information for a specific serving size"""
        if serving_size_id:
            serving = FoodServingSize.query.get(serving_size_id)
            if serving and serving.food_id == self.id:
                multiplier = serving.grams_equivalent / 100.0
            else:
                multiplier = 1.0
        else:
            # Calculate based on amount and unit
            if unit.lower() in ['g', 'gram', 'grams']:
                multiplier = amount / 100.0
            elif unit.lower() in ['oz', 'ounce', 'ounces']:
                multiplier = (amount * 28.35) / 100.0  # Convert oz to grams
            else:
                multiplier = 1.0  # Default to 100g basis
        
        return {
            'calories': self.calories * multiplier,
            'protein': (self.protein or 0) * multiplier,
            'carbs': (self.carbs or 0) * multiplier,
            'fat': (self.fat or 0) * multiplier,
            'fiber': (self.fiber or 0) * multiplier,
            'sugar': (self.sugar or 0) * multiplier,
            'sodium': (self.sodium or 0) * multiplier,
            'saturated_fat': (self.saturated_fat or 0) * multiplier,
            'trans_fat': (self.trans_fat or 0) * multiplier,
            'cholesterol': (self.cholesterol or 0) * multiplier,
            'potassium': (self.potassium or 0) * multiplier,
            'vitamin_c': (self.vitamin_c or 0) * multiplier,
            'calcium': (self.calcium or 0) * multiplier,
            'iron': (self.iron or 0) * multiplier
        }
    
    def get_common_serving_sizes(self):
        """Get list of common serving sizes for this food"""
        return FoodServingSize.query.filter_by(food_id=self.id, is_common=True).order_by(FoodServingSize.amount).all()
    
    def get_default_serving_size(self):
        """Get the default serving size for this food"""
        return FoodServingSize.query.filter_by(food_id=self.id, is_default=True).first()

class UserFavoriteFood(db.Model):
    __tablename__ = 'user_favorite_food'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    food_id = db.Column(db.Integer, db.ForeignKey('food_reference.id'), primary_key=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

class FoodEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    food_name = db.Column(db.String(100), nullable=False)
    calories = db.Column(db.Integer, nullable=False)
    protein = db.Column(db.Float, nullable=True)
    carbs = db.Column(db.Float, nullable=True)
    fat = db.Column(db.Float, nullable=True)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)

class FoodSummary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    calories = db.Column(db.Float)
    protein = db.Column(db.Float)
    carbs = db.Column(db.Float)
    fat = db.Column(db.Float)
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='uix_food_summary_user_date'),)

class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    exercise = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=True)
    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    sets = db.Column(db.Integer, nullable=False)
    total_weight = db.Column(db.Float, nullable=True)  # New: total weight (plates + barbell)
    
    # Removed session_exercise_id foreign key to fix circular reference

class ExerciseCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(200), nullable=True)
    
    # Relationship to exercises
    exercises = db.relationship('Exercise', backref='category', lazy=True, cascade='all, delete-orphan')

class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # Make name unique across all exercises
    category_id = db.Column(db.Integer, db.ForeignKey('exercise_category.id'), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    equipment = db.Column(db.String(100), nullable=True)
    muscle_groups = db.Column(db.String(200), nullable=True)

class UserExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('exercise_category.id'), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    equipment = db.Column(db.String(100), nullable=True)
    muscle_groups = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='custom_exercises')
    category = db.relationship('ExerciseCategory')
    
    # Ensure unique exercise names per user
    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='uix_user_exercise_user_name'),)

class Trade(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    asset = db.Column(db.String(50), nullable=False)
    trade_type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    price = db.Column(db.Float, nullable=False)
    total_cost = db.Column(db.Float, nullable=False)
    fees = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)

class PnL(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    starting_balance = db.Column(db.Float, nullable=False)
    current_balance = db.Column(db.Float, nullable=False)
    profit_loss = db.Column(db.Float, nullable=False)
    risk_1_percent = db.Column(db.Float, nullable=False)
    risk_5_percent = db.Column(db.Float, nullable=False)
    risk_10_percent = db.Column(db.Float, nullable=False)

class WeeklyReview(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    week = db.Column(db.Integer, nullable=False)
    what_worked = db.Column(db.Text, nullable=False)
    what_didnt = db.Column(db.Text, nullable=False)
    trade_type = db.Column(db.String(50), nullable=True)
    market_timing = db.Column(db.Text, nullable=True)
    entry_too_soon = db.Column(db.Text, nullable=True)
    entry_too_late = db.Column(db.Text, nullable=True)
    profit_too_late = db.Column(db.Text, nullable=True)
    stops_too_tight = db.Column(db.Text, nullable=True)
    risk_reward = db.Column(db.Text, nullable=True)
    risk_too_little = db.Column(db.Text, nullable=True)
    deviated_from_plan = db.Column(db.Text, nullable=True)
    recurring_problems = db.Column(db.Text, nullable=True)
    recurring_positives = db.Column(db.Text, nullable=True)
    tasks = db.Column(db.Text, nullable=True)

class Mood(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text, nullable=True)

class Work(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    opportunity_name = db.Column(db.String(100), nullable=False)
    next_steps = db.Column(db.Text, nullable=False)
    action_items = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='Q2')
    arr = db.Column(db.Float, nullable=True)
    cbc = db.Column(db.Date, nullable=True)
    next_step_date = db.Column(db.Date, nullable=True)
    risks = db.Column(db.Text, nullable=True)

# TargetAccount model for Kanban Target Accounts
class TargetAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='Prospecting')  # Kanban column
    notes = db.Column(db.Text, nullable=True)
    arr = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<TargetAccount {self.account_name} ({self.status})>'

class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    activity_type = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Float, nullable=False)  # Duration in minutes
    intensity = db.Column(db.String(20), nullable=False)  # Low, Moderate, High
    calories_burned = db.Column(db.Integer)  # Estimated calories
    miles = db.Column(db.Float, nullable=True)  # Distance in miles
    activity_level = db.Column(db.String(20), nullable=True)  # General activity level for the day

class TDEE(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    bmr = db.Column(db.Integer)  # Basal Metabolic Rate
    activity_calories = db.Column(db.Integer)  # From activities
    tdee = db.Column(db.Integer)  # Total Daily Energy Expenditure
    calorie_intake = db.Column(db.Integer)  # From FoodEntry
    activity_level = db.Column(db.String(20))
    activity_multiplier = db.Column(db.Float)
    base_tdee = db.Column(db.Integer)
    
    # Fix: Change unique constraint to be per user per date
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='uix_tdee_user_date'),)

class UserSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Display Settings
    theme = db.Column(db.String(20), default='light')  # light, dark, auto
    units = db.Column(db.String(10), default='imperial')  # imperial, metric
    date_format = db.Column(db.String(20), default='MM/DD/YYYY')  # MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    
    # Fitness Settings
    activity_level = db.Column(db.String(20), default='moderate')  # sedentary, light, moderate, active, very_active
    goal = db.Column(db.String(20), default='maintain')  # lose, maintain, gain
    weekly_goal = db.Column(db.Float, default=0.5)  # lbs per week
    calorie_deficit = db.Column(db.Integer, default=500)  # daily calorie deficit/surplus
    
    # Notification Settings
    email_notifications = db.Column(db.Boolean, default=True)
    reminder_frequency = db.Column(db.String(20), default='daily')  # daily, weekly, monthly, never
    reminder_time = db.Column(db.String(10), default='09:00')  # HH:MM format
    
    # Privacy Settings
    profile_visibility = db.Column(db.String(20), default='private')  # private, friends, public
    share_progress = db.Column(db.Boolean, default=False)
    
    # Data Settings
    auto_backup = db.Column(db.Boolean, default=True)
    data_retention_days = db.Column(db.Integer, default=365)  # days to keep data
    
    # New: Dashboard section preferences (JSON string)
    dashboard_sections = db.Column(db.Text, nullable=True)  # JSON array of enabled sections
    
    # Created/Updated timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship - removed to fix backref conflict

class UserFavoriteExercise(db.Model):
    __tablename__ = 'user_favorite_exercise'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), primary_key=True)

class WorkoutTemplate(db.Model):
    """Model for storing reusable workout templates"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Push Day", "Legs & Core"
    description = db.Column(db.Text, nullable=True)  # Optional description
    notes = db.Column(db.Text, nullable=True)  # User notes about the template
    is_public = db.Column(db.Boolean, default=False)  # Can be shared with other users
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    exercises = db.relationship('WorkoutTemplateExercise', backref='template', cascade='all, delete-orphan', order_by='WorkoutTemplateExercise.order')
    sessions = db.relationship('WorkoutSession', backref='template')
    
    # Ensure unique template names per user
    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='uix_workout_template_user_name'),)

class WorkoutTemplateExercise(db.Model):
    """Model for storing exercises within a workout template"""
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workout_template.id'), nullable=False)
    exercise_name = db.Column(db.String(100), nullable=False)  # Store exercise name directly
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=True)  # Optional link to Exercise model
    category_id = db.Column(db.Integer, db.ForeignKey('exercise_category.id'), nullable=True)
    order = db.Column(db.Integer, nullable=False, default=0)  # For ordering exercises
    notes = db.Column(db.Text, nullable=True)  # Exercise-specific notes
    target_sets = db.Column(db.Integer, nullable=True)  # Suggested number of sets
    target_reps = db.Column(db.Integer, nullable=True)  # Suggested number of reps
    target_weight = db.Column(db.Float, nullable=True)  # Suggested weight (optional)
    rest_time = db.Column(db.Integer, nullable=True)  # Rest time in seconds
    
    # Relationships
    exercise = db.relationship('Exercise', backref='template_exercises')
    
    # Ensure unique exercise order per template
    __table_args__ = (db.UniqueConstraint('template_id', 'order', name='uix_template_exercise_order'),)

class WorkoutSession(db.Model):
    """Model for storing actual workout sessions (daily logs)"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('workout_template.id'), nullable=True)  # Optional - can be created from template
    name = db.Column(db.String(100), nullable=False)  # e.g., "Push Day - June 26"
    date = db.Column(db.Date, nullable=False)  # Date of the workout
    notes = db.Column(db.Text, nullable=True)  # Session-specific notes
    status = db.Column(db.String(20), default='planned')  # planned, in_progress, completed, cancelled
    started_at = db.Column(db.DateTime, nullable=True)  # When user started the workout
    completed_at = db.Column(db.DateTime, nullable=True)  # When user completed the workout
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    exercises = db.relationship('WorkoutSessionExercise', backref='session', cascade='all, delete-orphan', order_by='WorkoutSessionExercise.order')
    
    # Ensure one session per user per date (optional - you might want multiple sessions per day)
    __table_args__ = (db.UniqueConstraint('user_id', 'date', 'name', name='uix_workout_session_user_date_name'),)

class WorkoutSessionExercise(db.Model):
    """Model for storing exercises within a workout session"""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('workout_session.id'), nullable=False)
    exercise_name = db.Column(db.String(100), nullable=False)  # Store exercise name directly
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=True)  # Optional link to Exercise model
    category_id = db.Column(db.Integer, db.ForeignKey('exercise_category.id'), nullable=True)
    order = db.Column(db.Integer, nullable=False, default=0)  # For ordering exercises
    notes = db.Column(db.Text, nullable=True)  # Exercise-specific notes
    target_sets = db.Column(db.Integer, nullable=True)  # Planned number of sets
    target_reps = db.Column(db.Integer, nullable=True)  # Planned number of reps
    target_weight = db.Column(db.Float, nullable=True)  # Planned weight
    rest_time = db.Column(db.Integer, nullable=True)  # Rest time in seconds
    completed = db.Column(db.Boolean, default=False)  # Whether this exercise was completed
    
    # Relationships
    exercise = db.relationship('Exercise', backref='session_exercises')
    # Removed problematic sets relationship - no proper foreign key exists
    
    # Ensure unique exercise order per session
    __table_args__ = (db.UniqueConstraint('session_id', 'order', name='uix_session_exercise_order'),)

class WorkColumn(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), nullable=False, unique=True)
    order = db.Column(db.Integer, nullable=False, default=0)

class ProgressPic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    description = db.Column(db.String(500), nullable=True)
    
    # Relationship
    user = db.relationship('User', backref='progress_pics')

class PersonalRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    exercise = db.Column(db.String(100), nullable=False)
    pr_type = db.Column(db.String(50), nullable=False)  # 'weight', 'reps', 'volume', 'milestone'
    value = db.Column(db.Float, nullable=False)  # The actual PR value
    weight = db.Column(db.Float, nullable=True)  # Weight used for the PR
    reps = db.Column(db.Integer, nullable=True)  # Reps used for the PR
    sets = db.Column(db.Integer, nullable=True)  # Sets used for the PR
    date_achieved = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    workout_id = db.Column(db.Integer, db.ForeignKey('workout.id'), nullable=True)  # Link to the workout that set the PR
    notes = db.Column(db.String(500), nullable=True)  # Optional notes about the PR
    
    # Relationships
    user = db.relationship('User', backref='personal_records')
    workout = db.relationship('Workout', backref='personal_records')
    
    # Ensure unique PRs per user, exercise, and type
    __table_args__ = (db.UniqueConstraint('user_id', 'exercise', 'pr_type', name='uix_personal_record_user_exercise_type'),)

class FastingPeriod(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=True)  # Calculated duration
    status = db.Column(db.String(20), nullable=False, default='active')  # 'active', 'completed', 'cancelled'
    notes = db.Column(db.String(500), nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='fasting_periods')
    
    def calculate_duration(self):
        """Calculate duration in minutes"""
        if self.end_time:
            return int((self.end_time - self.start_time).total_seconds() / 60)
        else:
            return int((datetime.utcnow() - self.start_time).total_seconds() / 60)
    
    def get_duration_display(self):
        """Get formatted duration string"""
        hours = self.duration_minutes // 60
        minutes = self.duration_minutes % 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"

class DistanceMilestone(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    trail_name = db.Column(db.String(100), nullable=False)
    trail_distance = db.Column(db.Float, nullable=False)  # in miles
    completed_distance = db.Column(db.Float, default=0.0)  # in miles
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    user = db.relationship('User', backref='distance_milestones')
    
    def __repr__(self):
        return f'<DistanceMilestone {self.trail_name}>'
    
    def get_progress_percentage(self):
        """Calculate progress percentage"""
        if self.trail_distance == 0:
            return 0
        return (self.completed_distance / self.trail_distance) * 100
    
    def get_remaining_distance(self):
        """Calculate remaining distance"""
        return max(0, self.trail_distance - self.completed_distance)
    
    def is_completed(self):
        """Check if milestone is completed"""
        return self.completed_distance >= self.trail_distance

class RepeatActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    activity_type = db.Column(db.String(64), nullable=False)
    duration = db.Column(db.Float, nullable=False)
    intensity = db.Column(db.String(32), nullable=False)
    calories = db.Column(db.Float, nullable=True)
    miles = db.Column(db.Float, nullable=True)
    days_of_week = db.Column(db.String(32), nullable=False)  # e.g., "Mon,Wed,Fri"
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    # Optionally: add more fields (e.g., notes)