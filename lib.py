from __future__ import print_function
"""Front-end for working with lateral graph.

First step is to create a data generator, file_data_generator or
elastic_data_generator, depending of where you want to get plaso events from.

file_data_generator:
  Reads json_line file and yield one event at a time. It has to read the whole
  file, but has no memory requirements.

elastic_data_generator:
  Queries elasticsearch for events that it can parse. Also no memory
  requirements. Does not need to read all logs, but must wait for elasticsearch.
"""
from grapher import create_default_json
from parser import parse_line
import parsers.parsers as P
import sys


def file_data_generator(filename, verbose=False):
    """Reads json_line file and yields events.

    Json_line means, that every event is a json on a separate line.
    """
    input_file = open(filename)
    for i, line in enumerate(input_file):
        if not i % 100000 and verbose:
            print("File line ", i, file=sys.stderr)

        parsed = parse_line(line)

        if parsed:
            yield parsed


def elastic_data_generator(client, indexes, verbose=False):
    """Reads event data from elasticsearch.


    Args:
        client: Elasticsearch client.
        indexes: List of elasticsearch indexes.
        verbose: If True, prints progress.

    Yield:
        plaso event.


    Uses scan function, so the data is really processed like a stream.
    """

    from elasticsearch.helpers import scan

    # Generating term filter for data_types, that we can parse
    should = [{"term": {"data_type": data_type}}
              for data_type in P.ParserManager.get_parsed_types()]

    # Elasticsearch query.
    query = {
        "query": {
            "filtered": {
                "query": {"match_all": {}},
                "filter": {
                    "bool": {
                        "should": should,
                    }
                }
            }
        }
    }

    for i, response in enumerate(scan(client, query=query, index=indexes)):
        if not i % 1000 and verbose:
            print("Elastic records ", i, file=sys.stderr)

        event = response['_source']
        event["timesketch_id"] = response["_id"]
        yield event


def get_client(host, port):
    """ Returns elasticsearch client for given port and host address."""
    from elasticsearch import Elasticsearch
    client = Elasticsearch([{u'host': host, u'port': port}])
    return client


def get_graph_json(raw_generator, verbose=False):
    """Returns json representation for graph created based on raw_generator."""

    def parsed_generator(raw_generator):
        """Transform raw event generator to parsed events generator."""
        for raw_event in raw_generator:
            yield P.ParserManager.parse(raw_event)

    graph_json = create_default_json(parsed_generator(raw_generator), verbose)
    return graph_json


if __name__ == "__main__":
    #TODO make a command line tool out of this
    if len(sys.argv) <= 2:
        print("ip and port")
        sys.exit(1)

    #These indexes are specific for my machine!
    my_indexes = [
        "d7f26dc5d9084ed58de0ea22d694700c",
        "72bd4e869139471a98a01ebf8288d4f2",
        "60f93e5a441d49cea662ce040a76b4d1",
        "c4f5c5da75534ba0b4f4d73871bd6e1c",
        "ee8a1660b6b644f6998a5054532389d0",
    ]

    #generator = file_data_generator(sys.argv[1], True)
    generator = elastic_data_generator(
        get_client(sys.argv[1], sys.argv[2]), my_indexes, True)

    graph = get_graph_json(generator, verbose=True)
    outfile = open("out.js", "w")
    print("var graph=", file=outfile)
    print(graph, file=outfile)
    print(";", file=outfile)
