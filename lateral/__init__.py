from flask import Flask
from lateral.resources import LateralGraph
from lateral.views import views

app = Flask(__name__)
app.register_blueprint(views)

from flask_restful import Api

api = Api(app, prefix='/api/')
api.add_resource(LateralGraph,'/')

