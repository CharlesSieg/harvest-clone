from models import db, Settings, ExpenseCategory


def seed_data():
    if Settings.query.first() is None:
        settings = Settings(
            company_name='My Company',
            default_billable_rate=150.00
        )
        db.session.add(settings)

    default_categories = ['Entertainment', 'Meals', 'Lodging', 'Mileage', 'Transportation', 'Other']
    if ExpenseCategory.query.first() is None:
        for name in default_categories:
            db.session.add(ExpenseCategory(name=name))

    db.session.commit()
