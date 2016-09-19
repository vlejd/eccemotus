from flask import Flask, render_template, jsonify, request, redirect, url_for
import sqlite3
from flask import g
import json

DATABASE = 'eccemotus.sql'
app = Flask(__name__)


def get_db():
  db = getattr(g, '_database', None)
  if db is None:
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    g._database = db
  return db


@app.teardown_appcontext
def close_connection(exception):
  db = getattr(g, '_database', None)
  if db is not None:
    db.close()


@app.route('/drop')
def drop():
  db = get_db()
  c = db.cursor()
  c.execute('''DROP TABLE IF EXISTS graphs''')
  db.commit()
  return "dropped"


@app.route('/prepare')
def prepare():
  db = get_db()
  c = db.cursor()
  c.execute('''CREATE TABLE IF NOT EXISTS graphs
      (id INTEGER PRIMARY KEY, name TEXT, graph BLOB )''')
  db.commit()
  return "prepared"


def add_graph(name, graph):
  print "adding"
  db = get_db()
  c = db.cursor()
  c.execute("INSERT INTO graphs (name, graph) VALUES (?,?)", (name, graph))
  db.commit()
  return "done"


@app.route('/graph/<graph_id>')
def graph_viewer(graph_id):
  db = get_db()
  c = db.cursor()
  c.execute("SELECT id, name from graphs where id = ?", (graph_id, ))
  graph = c.fetchall()
  if len(graph) != 1:
    return "Database returned %d graphs. Expected 1." % (len(graphs))

  return render_template('graph.html', graph=graph[0])


@app.route('/api/graph/<graph_id>')
def graph_geter(graph_id):
  db = get_db()
  c = db.cursor()
  c.execute("SELECT id, name, graph from graphs where id = ?", (graph_id, ))
  graph = c.fetchall()
  if len(graph) != 1:
    return None

  return jsonify(graph=json.loads(graph[0]['graph']))


def list_graphs():
  db = get_db()
  c = db.cursor()
  c.execute("SELECT id, name from graphs")
  data = c.fetchall()
  return data


from eccemotus.eccemotus import file_data_generator, elastic_data_generator, get_client, get_graph_json


@app.route('/', methods=['GET', 'POST'])
def index():
  if request.method == 'POST':
    if request.form['submit'] == "file":
      fname = request.form['filename']
      graph_name = request.form['name']
      print fname, graph_name
      data_generator = file_data_generator(fname, verbose=True)
      graph = get_graph_json(data_generator, verbose=True)
      add_graph(graph_name, graph)
      return redirect(url_for('index'))

    else:
      print "elastic"
      graph_name = request.form['name']
      ip = request.form['ip']
      port = int(request.form['port'])
      indexes = filter(lambda x: x, request.form['indexes'].split())
      print graph_name, ip, port, indexes
      client = get_client(ip, port)

      data_generator = elastic_data_generator(client, indexes, verbose=True)
      graph = get_graph_json(data_generator, verbose=True)
      add_graph(graph_name, graph)
      return redirect(url_for('index'))

  graphs = list_graphs()
  return render_template('index.html', graphs=graphs)


def run():
  app.run(debug=True, host=u'127.0.0.1', port=5012)


if __name__ == "__main__":
  run()
