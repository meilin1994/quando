from __main__ import app

import os
from os.path import join as os_join
from flask import send_file, send_from_directory, render_template, jsonify
import socket

@app.route('/client/transparent.png')
def transparent():
    return send_file(os_join(app.root_path, 'client', 'transparent.png'))

@app.route('/client/client.html')
def client_htm():
    return send_file(os_join(app.root_path, 'templates', 'client.html'))

@app.route('/client/client.css')
def client_css():
    return send_file(os_join(app.root_path, 'client', 'client.css'))

@app.route('/client/client.js')
def client_js():
    return send_file(os_join(app.root_path, 'client', 'client.js'), mimetype="application/javascript")

@app.route('/client/setup')
def setup():
    return send_file(os_join(app.root_path, 'client', 'setup.html'))

@app.route('/client/setup.css')
def setup_css():
    return send_file(os_join(app.root_path, 'client', 'setup.css'))

@app.route('/client/media/<path:path>')
def media(path):
    return send_from_directory(os_join(app.root_path, 'client', 'media'), path)

# Only javascript files
@app.route('/client/modules/<path:path>')
def modules(path):
    return send_from_directory(os_join(app.root_path, 'client', 'modules'), path, mimetype="application/javascript")

@app.route('/client/lib/data/<path:path>')
def lib_data(path):
    return send_from_directory(os_join(app.root_path, 'client', 'lib', 'data'), path)

# Only javascript files in lib directory
@app.route('/client/lib/<path:path>')
def lib(path):
    return send_from_directory(os_join(app.root_path, 'client', 'lib'), path, mimetype="application/javascript")

@app.route('/client/deployed_js/<path:path>')
def deployed_js(path):
    return send_from_directory(os_join(app.root_path, 'client', 'deployed_js'), path, mimetype="application/javascript")

@app.route('/client/')
def client_index_html():
    return send_file(os_join(app.root_path, 'client', 'index.html'))

@app.route('/client/js/<file_name>')
def js_file(file_name):
    file_js = '/client/deployed_js/' + file_name
    title = file_name.replace(".js","")
    return render_template('client.html', title=title, file_js=file_js)

@app.route('/client/js')
def js_index_html():
    directory = os_join(app.root_path, 'client', 'deployed_js')
    files = []
    for file_ in os.listdir(directory):
        if file_.endswith(".js"):
            files.append(file_)
    data = {"ip": socket.gethostbyname(socket.gethostname()),
        "files":files, "success":True}
    return jsonify(data)
