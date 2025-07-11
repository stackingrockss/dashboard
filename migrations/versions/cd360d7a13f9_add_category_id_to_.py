"""Add category_id to WorkoutTemplateExercise

Revision ID: cd360d7a13f9
Revises: d84d740e21a7
Create Date: 2025-07-06 10:35:21.959916

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cd360d7a13f9'
down_revision = 'd84d740e21a7'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('workout_template_exercise', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_workout_template_exercise_category_id', 'exercise_category', ['category_id'], ['id'])

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('workout_template_exercise', schema=None) as batch_op:
        batch_op.drop_constraint('fk_workout_template_exercise_category_id', type_='foreignkey')
        batch_op.drop_column('category_id')

    # ### end Alembic commands ###
