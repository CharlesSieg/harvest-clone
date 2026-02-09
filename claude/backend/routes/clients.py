from flask import Blueprint, request, jsonify
from models import db, Client, Contact

bp = Blueprint('clients', __name__)


@bp.route('/api/clients', methods=['GET'])
def list_clients():
    active_only = request.args.get('active')
    q = Client.query.order_by(Client.name)
    if active_only == 'true':
        q = q.filter_by(active=True)
    clients = q.all()
    return jsonify([c.to_dict() for c in clients])


@bp.route('/api/clients', methods=['POST'])
def create_client():
    data = request.json
    client = Client(
        name=data['name'],
        address=data.get('address', ''),
        city=data.get('city', ''),
        state=data.get('state', ''),
        zip_code=data.get('zip_code', ''),
        currency=data.get('currency', 'USD'),
        invoice_due_days=data.get('invoice_due_days', 30),
    )
    db.session.add(client)
    db.session.commit()
    return jsonify(client.to_dict()), 201


@bp.route('/api/clients/<int:client_id>', methods=['GET'])
def get_client(client_id):
    client = Client.query.get_or_404(client_id)
    return jsonify(client.to_dict())


@bp.route('/api/clients/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    client = Client.query.get_or_404(client_id)
    data = request.json
    for field in ['name', 'address', 'city', 'state', 'zip_code', 'currency', 'invoice_due_days', 'active']:
        if field in data:
            setattr(client, field, data[field])
    db.session.commit()
    return jsonify(client.to_dict())


@bp.route('/api/clients/<int:client_id>', methods=['DELETE'])
def delete_client(client_id):
    client = Client.query.get_or_404(client_id)
    db.session.delete(client)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# Contacts
@bp.route('/api/clients/<int:client_id>/contacts', methods=['GET'])
def list_contacts(client_id):
    contacts = Contact.query.filter_by(client_id=client_id).all()
    return jsonify([c.to_dict() for c in contacts])


@bp.route('/api/clients/<int:client_id>/contacts', methods=['POST'])
def create_contact(client_id):
    Client.query.get_or_404(client_id)
    data = request.json
    contact = Contact(
        client_id=client_id,
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        email=data.get('email', ''),
        title=data.get('title', ''),
        office_phone=data.get('office_phone', ''),
        mobile_phone=data.get('mobile_phone', ''),
        fax=data.get('fax', ''),
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact.to_dict()), 201


@bp.route('/api/contacts/<int:contact_id>', methods=['PUT'])
def update_contact(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    data = request.json
    for field in ['first_name', 'last_name', 'email', 'title', 'office_phone', 'mobile_phone', 'fax']:
        if field in data:
            setattr(contact, field, data[field])
    db.session.commit()
    return jsonify(contact.to_dict())


@bp.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    db.session.delete(contact)
    db.session.commit()
    return jsonify({'message': 'Deleted'})
