import logging
from flask import Blueprint, request, jsonify, Response
from datetime import datetime
from io import StringIO
import csv
from models import db, Trade, PnL, WeeklyReview

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

trading_bp = Blueprint('trading', __name__)

@trading_bp.route('/api/trades', methods=['GET'])
def get_trades():
    try:
        id = request.args.get('id')
        if id:
            trade = Trade.query.get_or_404(id)
            return jsonify([{
                'id': trade.id,
                'date': trade.date.isoformat(),
                'asset': trade.asset,
                'trade_type': trade.trade_type,
                'quantity': trade.quantity,
                'price': trade.price,
                'total_cost': trade.total_cost,
                'fees': trade.fees,
                'notes': trade.notes
            }])
        trades = Trade.query.all()
        logger.debug(f"Fetched {len(trades)} trades")
        return jsonify([{
            'id': t.id,
            'date': t.date.isoformat(),
            'asset': t.asset,
            'trade_type': t.trade_type,
            'quantity': t.quantity,
            'price': t.price,
            'total_cost': t.total_cost,
            'fees': t.fees,
            'notes': t.notes
        } for t in trades])
    except Exception as e:
        logger.error(f"Error fetching trades: {str(e)}")
        return jsonify({'error': 'Failed to fetch trades'}), 500

@trading_bp.route('/add_trade', methods=['POST'])
def add_trade():
    try:
        data = request.form
        if not all(key in data for key in ['date', 'asset', 'trade_type', 'quantity', 'price', 'total_cost']):
            logger.warning("Missing required fields in add_trade")
            return jsonify({'error': 'Missing required fields'}), 400
        quantity = float(data['quantity'])
        price = float(data['price'])
        total_cost = float(data['total_cost'])
        fees = float(data['fees']) if data.get('fees') else 0.0
        if quantity <= 0 or price <= 0 or total_cost <= 0:
            logger.warning("Invalid trade values: quantity, price, or total_cost non-positive")
            return jsonify({'error': 'Quantity, price, and total cost must be positive'}), 400
        trade = Trade(
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            asset=data['asset'],
            trade_type=data['trade_type'],
            quantity=quantity,
            price=price,
            total_cost=total_cost,
            fees=fees,
            notes=data.get('notes')
        )
        db.session.add(trade)
        db.session.commit()
        logger.info(f"Added trade: {trade.id}")
        return jsonify({'message': 'Trade added successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in add_trade: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error adding trade: {str(e)}")
        return jsonify({'error': 'Failed to add trade'}), 500

@trading_bp.route('/edit_trade/<int:id>', methods=['PUT'])
def edit_trade(id):
    try:
        data = request.json
        trade = Trade.query.get_or_404(id)
        if not all(key in data for key in ['date', 'asset', 'trade_type', 'quantity', 'price', 'total_cost']):
            logger.warning(f"Missing required fields in edit_trade for ID {id}")
            return jsonify({'error': 'Missing required fields'}), 400
        quantity = float(data['quantity'])
        price = float(data['price'])
        total_cost = float(data['total_cost'])
        fees = float(data['fees']) if data.get('fees') else 0.0
        if quantity <= 0 or price <= 0 or total_cost <= 0:
            logger.warning(f"Invalid trade values in edit_trade for ID {id}")
            return jsonify({'error': 'Quantity, price, and total cost must be positive'}), 400
        trade.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        trade.asset = data['asset']
        trade.trade_type = data['trade_type']
        trade.quantity = quantity
        trade.price = price
        trade.total_cost = total_cost
        trade.fees = fees
        trade.notes = data.get('notes')
        db.session.commit()
        logger.info(f"Updated trade: {id}")
        return jsonify({'message': 'Trade updated successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in edit_trade for ID {id}: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error editing trade ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to edit trade'}), 500

@trading_bp.route('/api/trades/<int:id>', methods=['DELETE'])
def delete_trade(id):
    try:
        trade = Trade.query.get_or_404(id)
        db.session.delete(trade)
        db.session.commit()
        logger.info(f"Deleted trade: {id}")
        return jsonify({'message': 'Trade deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting trade ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to delete trade'}), 500

@trading_bp.route('/api/pnl', methods=['GET'])
def get_pnl():
    try:
        id = request.args.get('id')
        if id:
            pnl = PnL.query.get_or_404(id)
            return jsonify([{
                'id': pnl.id,
                'date': pnl.date.isoformat(),
                'starting_balance': pnl.starting_balance,
                'current_balance': pnl.current_balance,
                'profit_loss': pnl.current_balance - pnl.starting_balance,
                'risk_1_percent': pnl.current_balance * 0.01,
                'risk_5_percent': pnl.current_balance * 0.05,
                'risk_10_percent': pnl.current_balance * 0.10
            }])
        pnls = PnL.query.all()
        logger.debug(f"Fetched {len(pnls)} PnL entries")
        return jsonify([{
            'id': p.id,
            'date': p.date.isoformat(),
            'starting_balance': p.starting_balance,
            'current_balance': p.current_balance,
            'profit_loss': p.current_balance - p.starting_balance,
            'risk_1_percent': p.current_balance * 0.01,
            'risk_5_percent': p.current_balance * 0.05,
            'risk_10_percent': p.current_balance * 0.10
        } for p in pnls])
    except Exception as e:
        logger.error(f"Error fetching PnL: {str(e)}")
        return jsonify({'error': 'Failed to fetch PnL'}), 500

@trading_bp.route('/add_pnl', methods=['POST'])
def add_pnl():
    try:
        data = request.form
        if not all(key in data for key in ['date', 'starting_balance', 'current_balance']):
            logger.warning("Missing required fields in add_pnl")
            return jsonify({'error': 'Missing required fields'}), 400
        
        starting_balance = float(data['starting_balance'])
        current_balance = float(data['current_balance'])
        profit_loss = current_balance - starting_balance
        
        if starting_balance <= 0 or current_balance <= 0:
            logger.warning("Invalid P&L values: starting_balance or current_balance non-positive")
            return jsonify({'error': 'Starting and current balance must be positive'}), 400
        
        pnl = PnL(
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            starting_balance=starting_balance,
            current_balance=current_balance,
            profit_loss=profit_loss,
            risk_1_percent=current_balance * 0.01,
            risk_5_percent=current_balance * 0.05,
            risk_10_percent=current_balance * 0.10
        )
        db.session.add(pnl)
        db.session.commit()
        logger.info(f"Added P&L entry: {pnl.id}")
        return jsonify({'message': 'P&L entry added successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in add_pnl: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error adding P&L: {str(e)}")
        return jsonify({'error': 'Failed to add P&L entry'}), 500

@trading_bp.route('/edit_pnl/<int:id>', methods=['PUT'])
def edit_pnl(id):
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        pnl = PnL.query.get_or_404(id)
        if not all(key in data for key in ['date', 'starting_balance', 'current_balance']):
            logger.warning(f"Missing required fields in edit_pnl for ID {id}")
            return jsonify({'error': 'Missing required fields'}), 400
        
        starting_balance = float(data['starting_balance'])
        current_balance = float(data['current_balance'])
        profit_loss = current_balance - starting_balance
        
        if starting_balance <= 0 or current_balance <= 0:
            logger.warning(f"Invalid P&L values in edit_pnl for ID {id}")
            return jsonify({'error': 'Starting and current balance must be positive'}), 400
        
        pnl.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        pnl.starting_balance = starting_balance
        pnl.current_balance = current_balance
        pnl.profit_loss = profit_loss
        pnl.risk_1_percent = current_balance * 0.01
        pnl.risk_5_percent = current_balance * 0.05
        pnl.risk_10_percent = current_balance * 0.10
        
        db.session.commit()
        logger.info(f"Updated P&L entry: {id}")
        return jsonify({'message': 'P&L entry updated successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in edit_pnl for ID {id}: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error editing P&L ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to edit P&L entry'}), 500

@trading_bp.route('/api/pnl/<int:id>', methods=['DELETE'])
def delete_pnl(id):
    try:
        pnl = PnL.query.get_or_404(id)
        db.session.delete(pnl)
        db.session.commit()
        logger.info(f"Deleted P&L entry: {id}")
        return jsonify({'message': 'P&L entry deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting P&L ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to delete P&L entry'}), 500

@trading_bp.route('/api/weekly_reviews', methods=['GET'])
def get_weekly_reviews():
    try:
        id = request.args.get('id')
        if id:
            review = WeeklyReview.query.get_or_404(id)
            return jsonify([{
                'id': review.id,
                'year': review.year,
                'week': review.week,
                'what_worked': review.what_worked,
                'what_didnt': review.what_didnt,
                'trade_type': review.trade_type,
                'market_timing': review.market_timing,
                'entry_too_soon': review.entry_too_soon,
                'entry_too_late': review.entry_too_late,
                'profit_too_late': review.profit_too_late,
                'stops_too_tight': review.stops_too_tight,
                'risk_reward': review.risk_reward,
                'risk_too_little': review.risk_too_little,
                'deviated_from_plan': review.deviated_from_plan,
                'recurring_problems': review.recurring_problems,
                'recurring_positives': review.recurring_positives,
                'tasks': review.tasks,
                'date': f"{review.year}-W{review.week:02d}"
            }])
        reviews = WeeklyReview.query.order_by(WeeklyReview.year.desc(), WeeklyReview.week.desc()).all()
        logger.debug(f"Fetched {len(reviews)} weekly reviews")
        return jsonify([{
            'id': r.id,
            'year': r.year,
            'week': r.week,
            'what_worked': r.what_worked,
            'what_didnt': r.what_didnt,
            'trade_type': r.trade_type,
            'market_timing': r.market_timing,
            'entry_too_soon': r.entry_too_soon,
            'entry_too_late': r.entry_too_late,
            'profit_too_late': r.profit_too_late,
            'stops_too_tight': r.stops_too_tight,
            'risk_reward': r.risk_reward,
            'risk_too_little': r.risk_too_little,
            'deviated_from_plan': r.deviated_from_plan,
            'recurring_problems': r.recurring_problems,
            'recurring_positives': r.recurring_positives,
            'tasks': r.tasks,
            'date': f"{r.year}-W{r.week:02d}"
        } for r in reviews])
    except Exception as e:
        logger.error(f"Error fetching weekly reviews: {str(e)}")
        return jsonify({'error': 'Failed to fetch weekly reviews'}), 500

@trading_bp.route('/add_weekly_review', methods=['POST'])
def add_weekly_review():
    try:
        data = request.form
        if not all(key in data for key in ['year', 'week', 'what_worked', 'what_didnt']):
            logger.warning("Missing required fields in add_weekly_review")
            return jsonify({'error': 'Missing required fields'}), 400
        
        year = int(data['year'])
        week = int(data['week'])
        
        if week < 1 or week > 53:
            logger.warning("Invalid week number in add_weekly_review")
            return jsonify({'error': 'Week must be between 1 and 53'}), 400
        
        # Check if review already exists for this year/week
        existing_review = WeeklyReview.query.filter_by(year=year, week=week).first()
        if existing_review:
            logger.warning(f"Weekly review already exists for year {year}, week {week}")
            return jsonify({'error': 'Weekly review already exists for this week'}), 400
        
        review = WeeklyReview(
            year=year,
            week=week,
            what_worked=data['what_worked'],
            what_didnt=data['what_didnt'],
            trade_type=data.get('trade_type'),
            market_timing=data.get('market_timing'),
            entry_too_soon=data.get('entry_too_soon'),
            entry_too_late=data.get('entry_too_late'),
            profit_too_late=data.get('profit_too_late'),
            stops_too_tight=data.get('stops_too_tight'),
            risk_reward=data.get('risk_reward'),
            risk_too_little=data.get('risk_too_little'),
            deviated_from_plan=data.get('deviated_from_plan'),
            recurring_problems=data.get('recurring_problems'),
            recurring_positives=data.get('recurring_positives'),
            tasks=data.get('tasks')
        )
        db.session.add(review)
        db.session.commit()
        logger.info(f"Added weekly review: {review.id}")
        return jsonify({'message': 'Weekly review added successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in add_weekly_review: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error adding weekly review: {str(e)}")
        return jsonify({'error': 'Failed to add weekly review'}), 500

@trading_bp.route('/edit_weekly_review/<int:id>', methods=['PUT'])
def edit_weekly_review(id):
    try:
        data = request.json
        review = WeeklyReview.query.get_or_404(id)
        if not all(key in data for key in ['year', 'week', 'what_worked', 'what_didnt']):
            logger.warning(f"Missing required fields in edit_weekly_review for ID {id}")
            return jsonify({'error': 'Missing required fields'}), 400
        
        year = int(data['year'])
        week = int(data['week'])
        
        if week < 1 or week > 53:
            logger.warning(f"Invalid week number in edit_weekly_review for ID {id}")
            return jsonify({'error': 'Week must be between 1 and 53'}), 400
        
        # Check if review already exists for this year/week (excluding current review)
        existing_review = WeeklyReview.query.filter_by(year=year, week=week).filter(WeeklyReview.id != id).first()
        if existing_review:
            logger.warning(f"Weekly review already exists for year {year}, week {week}")
            return jsonify({'error': 'Weekly review already exists for this week'}), 400
        
        review.year = year
        review.week = week
        review.what_worked = data['what_worked']
        review.what_didnt = data['what_didnt']
        review.trade_type = data.get('trade_type')
        review.market_timing = data.get('market_timing')
        review.entry_too_soon = data.get('entry_too_soon')
        review.entry_too_late = data.get('entry_too_late')
        review.profit_too_late = data.get('profit_too_late')
        review.stops_too_tight = data.get('stops_too_tight')
        review.risk_reward = data.get('risk_reward')
        review.risk_too_little = data.get('risk_too_little')
        review.deviated_from_plan = data.get('deviated_from_plan')
        review.recurring_problems = data.get('recurring_problems')
        review.recurring_positives = data.get('recurring_positives')
        review.tasks = data.get('tasks')
        
        db.session.commit()
        logger.info(f"Updated weekly review: {id}")
        return jsonify({'message': 'Weekly review updated successfully'}), 200
    except ValueError as e:
        logger.error(f"Invalid input in edit_weekly_review for ID {id}: {str(e)}")
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error editing weekly review ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to edit weekly review'}), 500

@trading_bp.route('/api/weekly_reviews/<int:id>', methods=['DELETE'])
def delete_weekly_review(id):
    try:
        review = WeeklyReview.query.get_or_404(id)
        db.session.delete(review)
        db.session.commit()
        logger.info(f"Deleted weekly review: {id}")
        return jsonify({'message': 'Weekly review deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting weekly review ID {id}: {str(e)}")
        return jsonify({'error': 'Failed to delete weekly review'}), 500

@trading_bp.route('/upload_trades', methods=['POST'])
def upload_trades():
    try:
        if 'file' not in request.files:
            logger.warning("No file uploaded in upload_trades")
            return jsonify({'error': 'No file uploaded'}), 400
        file = request.files['file']
        if not file.filename.endswith('.csv'):
            logger.warning("Invalid file format in upload_trades")
            return jsonify({'error': 'File must be a CSV'}), 400
        stream = StringIO(file.stream.read().decode('UTF-8'))
        csv_reader = csv.DictReader(stream)
        required_fields = ['date', 'asset', 'trade_type', 'quantity', 'price', 'total_cost']
        if not all(field in csv_reader.fieldnames for field in required_fields):
            logger.warning("CSV missing required fields in upload_trades")
            return jsonify({'error': 'CSV missing required fields'}), 400
        for row in csv_reader:
            try:
                quantity = float(row['quantity'])
                price = float(row['price'])
                total_cost = float(row['total_cost'])
                fees = float(row['fees']) if row.get('fees') else 0.0
                if quantity <= 0 or price <= 0 or total_cost <= 0:
                    continue  # Skip invalid rows
                trade = Trade(
                    date=datetime.strptime(row['date'], '%Y-%m-%d').date(),
                    asset=row['asset'],
                    trade_type=row['trade_type'],
                    quantity=quantity,
                    price=price,
                    total_cost=total_cost,
                    fees=fees,
                    notes=row.get('notes')
                )
                db.session.add(trade)
            except (ValueError, KeyError):
                continue  # Skip invalid rows
        db.session.commit()
        logger.info("Successfully uploaded trades from CSV")
        return jsonify({'message': 'Trades uploaded successfully'}), 200
    except Exception as e:
        logger.error(f"Error uploading trades: {str(e)}")
        return jsonify({'error': 'Failed to upload trades'}), 500

@trading_bp.route('/export_trades')
def export_trades():
    try:
        trades = Trade.query.all()
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=['date', 'asset', 'trade_type', 'quantity', 'price', 'total_cost', 'fees', 'notes'])
        writer.writeheader()
        for trade in trades:
            writer.writerow({
                'date': trade.date.isoformat(),
                'asset': trade.asset,
                'trade_type': trade.trade_type,
                'quantity': trade.quantity,
                'price': trade.price,
                'total_cost': trade.total_cost,
                'fees': trade.fees,
                'notes': trade.notes
            })
        logger.info("Exported trades to CSV")
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=trades.csv'}
        )
    except Exception as e:
        logger.error(f"Error exporting trades: {str(e)}")
        return jsonify({'error': 'Failed to export trades'}), 500