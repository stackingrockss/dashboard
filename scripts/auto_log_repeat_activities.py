from datetime import date, datetime
from app import create_app, db
from models import RepeatActivity, Activity

def is_due_today(repeat, today):
    # Check if today is within start/end date and matches day of week
    if repeat.start_date > today:
        return False
    if repeat.end_date and today > repeat.end_date:
        return False
    weekday = today.strftime('%a')  # 'Mon', 'Tue', etc.
    return weekday in repeat.days_of_week

def auto_log_for_all_users():
    today = date.today()
    repeats = RepeatActivity.query.all()
    for repeat in repeats:
        if is_due_today(repeat, today):
            # Check if already logged
            exists = Activity.query.filter_by(
                user_id=repeat.user_id,
                date=today,
                activity_type=repeat.activity_type,
                duration=repeat.duration,
                intensity=repeat.intensity
            ).first()
            if not exists:
                activity = Activity(
                    user_id=repeat.user_id,
                    date=today,
                    activity_type=repeat.activity_type,
                    duration=repeat.duration,
                    intensity=repeat.intensity,
                    calories_burned=repeat.calories,
                    miles=repeat.miles
                )
                db.session.add(activity)
    db.session.commit()

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        auto_log_for_all_users() 