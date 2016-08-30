import json
import os
import parsers.parsers as P
import sys, traceback


def timeskech():
  pass
  #TODO make direct request to timesketch backend.
  # query by data_type, then load to somewhere (database)


def parse_line(line):
  event = json.loads(line)
  return parse_event(event)

def parse_event(event):
  data = None
  try:
    data = P.ParserManager.Parse(event)
  except Exception as e:
    print (event, file=sys.stderr)
    traceback.print_exc(file=sys.stdout)

  if data:
    data["timestamp"] = event.get("timestamp")
  return data

if __name__ == "__main__":
  if len(sys.argv) <= 2:
    print("give me outfile and json_line files")
    sys.exit()

  data = []
  parsed_c = 0
  for f_name in sys.argv[2:]:
    print (f_name, file=sys.stderr)
    f = open(f_name)
    for i, line in enumerate(f):
      parsed = parse_line(line)
      if parsed:
        parsed_c += 1
        data.append(parsed)
      if not i%(10**5):
        print(i, parsed_c)

  print ("outputting",file=sys.stderr)
  f = open(sys.argv[1],"w")
  json.dump(data,f)
  f.close()
