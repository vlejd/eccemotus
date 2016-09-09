import lateral.backend.lib as backend
from flask import Blueprint, abort
from flask_restful import Resource


class LateralGraph(Resource):
    def get(self):
        ip = '127.0.0.1'
        port = '9200'
        my_indexes = [
        "d7f26dc5d9084ed58de0ea22d694700c",
        #"72bd4e869139471a98a01ebf8288d4f2",
        #"60f93e5a441d49cea662ce040a76b4d1",
        #"c4f5c5da75534ba0b4f4d73871bd6e1c",
        #"ee8a1660b6b644f6998a5054532389d0",
        ]

        generator = backend.elastic_data_generator(
            backend.get_client(ip, port), my_indexes, True)

        graph = backend.get_graph(generator, verbose=True)

        return graph.minimal_serialize()
