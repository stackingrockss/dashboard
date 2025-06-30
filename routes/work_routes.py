from flask import Blueprint, request, jsonify, redirect, url_for, flash
from models import db, Work, WorkColumn, TargetAccount
from datetime import datetime, timedelta
from sqlalchemy import extract, func, distinct

work_bp = Blueprint('work', __name__)

@work_bp.route('/api/entries')
def get_work_entries():
    try:
        entries = Work.query.all()
        return jsonify([{
            'id': e.id,
            'opportunity_name': e.opportunity_name,
            'next_steps': e.next_steps,
            'action_items': e.action_items,
            'status': e.status,
            'arr': e.arr,
            'cbc': e.cbc.strftime('%Y-%m-%d') if e.cbc else None
        } for e in entries])
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/column-titles')
def get_column_titles():
    try:
        columns = WorkColumn.query.order_by(WorkColumn.order).all()
        titles = [col.title for col in columns]
        return jsonify({'column_titles': titles})
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/add', methods=['POST'])
def add_work_entry():
    try:
        data = request.form
        if not data.get('opportunity_name'):
            return jsonify({'error': 'Opportunity Name is required.'}), 400

        entry = Work()
        entry.opportunity_name = data.get('opportunity_name')
        entry.next_steps = data.get('next_steps', '')
        entry.action_items = data.get('action_items', '')
        entry.status = data.get('status', 'Q2')
        entry.arr = float(data['arr']) if data.get('arr') else None
        entry.cbc = datetime.strptime(data['cbc'], '%Y-%m-%d').date() if data.get('cbc') else None
        entry.next_step_date = datetime.strptime(data['next_step_date'], '%Y-%m-%d').date() if data.get('next_step_date') else None
        entry.risks = data.get('risks', '')

        db.session.add(entry)
        db.session.commit()
        
        return jsonify({'message': 'Work entry added successfully!'}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/edit/<int:id>', methods=['PUT'])
def edit_work_entry(id):
    try:
        data = request.get_json()
        entry = Work.query.get_or_404(id)
        
        # Check for partial updates
        if 'status' in data and len(data) == 1:
             entry.status = data.get('status', entry.status)
        else:
            if not data or not data.get('opportunity_name') or not data.get('next_steps'):
                return jsonify({'error': 'Missing required fields'}), 400
            entry.opportunity_name = data.get('opportunity_name', entry.opportunity_name)
            entry.next_steps = data.get('next_steps', entry.next_steps)
            entry.action_items = data.get('action_items', entry.action_items)
            entry.status = data.get('status', entry.status)
            arr_value = data.get('arr')
            entry.arr = float(arr_value) if arr_value else None
            from datetime import datetime
            cbc_value = data.get('cbc')
            entry.cbc = datetime.strptime(cbc_value, '%Y-%m-%d').date() if cbc_value else None
            next_step_date_value = data.get('next_step_date')
            entry.next_step_date = datetime.strptime(next_step_date_value, '%Y-%m-%d').date() if next_step_date_value else None
            entry.risks = data.get('risks', entry.risks)

        db.session.commit()
        return jsonify({'message': 'Work entry updated'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/update_column_title', methods=['POST'])
def update_column_title():
    try:
        data = request.get_json()
        old_title = data.get('old_title')
        new_title = data.get('new_title')

        if not old_title or not new_title:
            return jsonify({'error': 'Old and new titles are required.'}), 400

        # Update the column title in WorkColumn
        column = WorkColumn.query.filter_by(title=old_title).first()
        if not column:
            return jsonify({'error': 'Column not found.'}), 404
        column.title = new_title
        db.session.commit()

        # Update all Work entries with the old status
        Work.query.filter_by(status=old_title).update({'status': new_title})
        db.session.commit()

        return jsonify({'message': 'Column title updated successfully!'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/delete/<int:id>', methods=['DELETE'])
def delete_work_entry(id):
    try:
        entry = Work.query.get_or_404(id)
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'message': 'Work entry deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/arr_by_quarter')
def arr_by_quarter():
    try:
        # Query all Work entries with ARR and CBC (close by calendar)
        results = db.session.query(
            func.extract('year', Work.cbc).label('year'),
            func.extract('quarter', Work.cbc).label('quarter'),
            func.sum(Work.arr).label('total_arr')
        ).filter(Work.arr != None, Work.cbc != None).group_by('year', 'quarter').order_by('year', 'quarter').all()

        # Format results as a list of dicts
        arr_data = [
            {'year': int(r.year), 'quarter': int(r.quarter), 'total_arr': float(r.total_arr)}
            for r in results
        ]
        return jsonify({'arr_by_quarter': arr_data})
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# --- TargetAccount API Endpoints ---

@work_bp.route('/api/target-accounts', methods=['GET'])
def get_target_accounts():
    """List all target accounts, optionally filter by status (column)."""
    try:
        status = request.args.get('status')
        query = TargetAccount.query
        if status:
            query = query.filter_by(status=status)
        accounts = query.order_by(TargetAccount.created_at.desc()).all()
        return jsonify([
            {
                'id': a.id,
                'account_name': a.account_name,
                'description': a.description,
                'status': a.status,
                'notes': a.notes,
                'arr': a.arr,
                'created_at': a.created_at.isoformat() if a.created_at else None,
                'updated_at': a.updated_at.isoformat() if a.updated_at else None
            } for a in accounts
        ])
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/target-accounts', methods=['POST'])
def add_target_account():
    """Create a new target account."""
    try:
        data = request.get_json()
        if not data or not data.get('account_name'):
            return jsonify({'error': 'Account Name is required.'}), 400
        account = TargetAccount(
            account_name=data['account_name'],
            description=data.get('description', ''),
            status=data.get('status', 'Prospecting'),
            notes=data.get('notes', ''),
            arr=float(data['arr']) if data.get('arr') else None
        )
        db.session.add(account)
        db.session.commit()
        return jsonify({'message': 'Target account added!', 'id': account.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/target-accounts/<int:id>', methods=['PUT'])
def update_target_account(id):
    """Update a target account (including moving columns)."""
    try:
        data = request.get_json()
        account = TargetAccount.query.get_or_404(id)
        if 'account_name' in data:
            account.account_name = data['account_name']
        if 'description' in data:
            account.description = data['description']
        if 'status' in data:
            account.status = data['status']
        if 'notes' in data:
            account.notes = data['notes']
        if 'arr' in data:
            account.arr = float(data['arr']) if data['arr'] else None
        db.session.commit()
        return jsonify({'message': 'Target account updated!'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/target-accounts/<int:id>', methods=['DELETE'])
def delete_target_account(id):
    """Delete a target account."""
    try:
        account = TargetAccount.query.get_or_404(id)
        db.session.delete(account)
        db.session.commit()
        return jsonify({'message': 'Target account deleted!'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/target-accounts/statuses', methods=['GET'])
def get_target_account_statuses():
    """List all unique statuses (columns) for Target Accounts."""
    try:
        statuses = db.session.query(distinct(TargetAccount.status)).all()
        return jsonify({'statuses': [s[0] for s in statuses]})
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# --- Dashboard API Endpoints ---

@work_bp.route('/api/dashboard/opportunity-overview')
def dashboard_opportunity_overview():
    try:
        total_opps = Work.query.count()
        total_arr = db.session.query(func.sum(Work.arr)).scalar() or 0
        # Count by status
        status_counts = db.session.query(Work.status, func.count(Work.id)).group_by(Work.status).all()
        status_breakdown = {status: count for status, count in status_counts}
        return jsonify({
            'total_opportunities': total_opps,
            'total_arr': total_arr,
            'status_breakdown': status_breakdown
        })
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/dashboard/next-steps-week')
def dashboard_next_steps_week():
    try:
        today = datetime.utcnow().date()
        week_later = today + timedelta(days=7)
        opps = Work.query.filter(
            Work.next_step_date != None,
            Work.next_step_date >= today,
            Work.next_step_date <= week_later
        ).order_by(Work.next_step_date).all()
        return jsonify([
            {
                'id': o.id,
                'opportunity_name': o.opportunity_name,
                'next_steps': o.next_steps,
                'next_step_date': o.next_step_date.strftime('%Y-%m-%d') if o.next_step_date else None,
                'status': o.status,
                'arr': o.arr
            } for o in opps
        ])
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@work_bp.route('/api/dashboard/cbc-week')
def dashboard_cbc_week():
    try:
        today = datetime.utcnow().date()
        week_later = today + timedelta(days=7)
        opps = Work.query.filter(
            Work.cbc != None,
            Work.cbc >= today,
            Work.cbc <= week_later
        ).order_by(Work.cbc).all()
        return jsonify([
            {
                'id': o.id,
                'opportunity_name': o.opportunity_name,
                'cbc': o.cbc.strftime('%Y-%m-%d') if o.cbc else None,
                'status': o.status,
                'arr': o.arr
            } for o in opps
        ])
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500