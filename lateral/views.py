from flask import Blueprint, abort

views = Blueprint('views', __name__)
@views.route('/')
def index():
    return 'Comming soon!'

