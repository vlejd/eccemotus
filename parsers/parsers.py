""" TODO(vlejd) copyright """

""" Provides easy way for parsing mainly plaso logs.

Just use ParserManager.parse(log) and it will return fields important for
entity matching purposes and entity annotation.
"""
import re
import sys


SOURCE_MACHINE_IP = "source:ip"
SOURCE_MACHINE_NAME = "source:machine_name"
TARGET_MACHINE_IP = "target:ip"
TARGET_MACHINE_NAME = "target:machine_name"
TARGET_USER_ID = "target:user_id"
TARGET_USER_NAME = "target:user_name"
TARGET_PID = "target:pid"


#TODO add class for mac:asl:event   probably certificates
#TODO write description for these Data types
#TODO inheritance
#TODO use pathspec for identifiers !!!!!
#TODO identifiers
#TODO what does ip 127.0.0.1 and ::1 means for ssh login
#TODO windows sharing logs



class ParserManager():
  """ Manages individual parsers.

  You can add a parser with RegisterParser() or parse event with Parse()
  """

  _parser_clases = {}

  @classmethod
  def GetParsedTypes(cls):
    return _parser_clases.keys()

  @classmethod
  def RegisterParser(cls, parser_cls):
    cls._parser_clases[parser_cls.DATA_TYPE]=parser_cls

  @classmethod
  def Parse(cls, event):
    """ Determines which parser should be used and uses it.

    Parser are chosen based on data_type of leg message.
    """
    raw_data_type = event.get("data_type")
    data_type = None
    if type(raw_data_type) is str:
      data_type = raw_data_type
    elif type(raw_data_type) is dict:
      data_type = raw_data_type.get("stream")
    else:
      print("what is this?", raw_data_type, file=sys.stderr)

    if data_type in cls._parser_clases:
      return cls._parser_clases[data_type].Parse(event)

""" Classes for ssh and other forms of "machine jumping" """

class LinuxUtmpEventParser():
  DATA_TYPE = "linux:utmp:event"

  @classmethod
  def Parse(cls, event):
    data = {}
    data[TARGET_USER_NAME] = event.get("user")
    data[TARGET_MACHINE_NAME] = event.get("hostname")
    #TODO message User: dean Computer Name: 192.168.1.11 Terminal: ssh:notty PID: 16290 Terminal_ID: 0 Status: LOGIN_PROCESS IP Address: 192.168.1.11 Exit: 0
    # PID? terminal id?
    ip = event.get("ip_address",{})
    if type(ip) is dict:
      data[SOURCE_MACHINE_IP] = ip.get("stream")
    elif type(ip) is str:
      data[SOURCE_MACHINE_IP] = ip

    data[SOURCE_MACHINE_NAME] = event.get("computer_name")
    user = re.search("User: (\S+)", event["message"])
    if user:
      data[TARGET_USER_NAME] = user.group(1)
    return data
ParserManager.RegisterParser(LinuxUtmpEventParser)


class WinEvtxEventParser():
  DATA_TYPE = "windows:evtx:record"

  @classmethod
  def Parse(cls, event):
    " wha is 4675? sids were filtered?!"
    " what is 1149  "
    " 4634 is logout - not interesting, but could be"

    data = {}
    event_id = event.get("event_identifier")

    if event_id == 4624: #An account was successfully logged on
      field_mapper = {SOURCE_MACHINE_IP:18,
                      SOURCE_MACHINE_NAME:11,
                      TARGET_USER_ID:4}
      for field_name, field_index in field_mapper.items():
        data[field_name] = event["strings"][field_index]
      data[TARGET_MACHINE_NAME] = event["computer_name"]
      return data

    elif event_id == 4648: #login with certificate
      #TODO what is SubjectUserName?
      #TODO which IP is which
      #TODO do this
      #TODO are those things target or source info ?
      """
      '<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\n  <System>\n    <Provider Name="Microsoft-Windows-Security-Auditing" Guid="{54849625-5478-4994-A5BA-3E3B0328C30D}"/>\n    <EventID>4648</EventID>\n    <Version>0</Version>\n    <Level>0</Level>\n    <Task>12544</Task>\n    <Opcode>0</Opcode>\n    <Keywords>0x8020000000000000</Keywords>\n    <TimeCreated SystemTime="2015-08-08T16:58:39.317734300Z"/>\n    <EventRecordID>118</EventRecordID>\n    <Correlation/>\n    <Execution ProcessID="452" ThreadID="276"/>\n    <Channel>Security</Channel>\n    <Computer>GREENDALEGOLD</Computer>\n    <Security/>\n  </System>\n  <EventData>\n    <Data Name="SubjectUserSid">S-1-5-18</Data>\n    <Data Name="SubjectUserName">WIN-LK5OF8CDD94$</Data>\n    <Data Name="SubjectDomainName">WORKGROUP</Data>\n    <Data Name="SubjectLogonId">0x00000000000003e7</Data>\n    <Data Name="LogonGuid">{00000000-0000-0000-0000-000000000000}</Data>\n    <Data Name="TargetUserName">gold_administrator</Data>\n    <Data Name="TargetDomainName">GREENDALEGOLD</Data>\n    <Data Name="TargetLogonGuid">{00000000-0000-0000-0000-000000000000}</Data>\n    <Data Name="TargetServerName">localhost</Data>\n    <Data Name="TargetInfo">localhost</Data>\n    <Data Name="ProcessId">0x0000000000000178</Data>\n    <Data Name="ProcessName">C:\\Windows\\System32\\winlogon.exe</Data>\n    <Data Name="IpAddress">127.0.0.1</Data>\n    <Data Name="IpPort">0</Data>\n  </EventData>\n</Event>\n
      """

      return {}

    else:
      return {}
ParserManager.RegisterParser(WinEvtxEventParser)

class BsmEventParser():
  #  bsm:event (event_type OpenSSH login (32800), AUE_ssh      6172
  #  can provide IP and username, ends with logout - local (6153))
  DATA_TYPE = "bsm:event"
  SUCCESS_REGEXP = re.compile(".*BSM_TOKEN_RETURN32: Success*.")
  USER_REGEXP = re.compile("BSM_TOKEN_TEXT: successful login (\S+)\]")
  TOKEN_REGEXP = re.compile("\[BSM_TOKEN_SUBJECT32_EX: (.*?)\]")

  @classmethod
  def Parse(cls, event):
    data = {}
    event_id = event.get("event_type")
    message = event.get("message","")
    if not (event_id == "OpenSSH login (32800)" and
      cls.SUCCESS_REGEXP.match(message)):
      return {}

    user = cls.USER_REGEXP.search(message)
    if user:
      data[TARGET_USER_NAME] = user.group(1)

    raw_tokens = cls.TOKEN_REGEXP.search(message)
    token_dict = {}
    if raw_tokens:
      tokens = raw_tokens.group(1).split(',')
      for x in tokens:
        key, value = x.strip(" )").split("(")
        token_dict[key] = value
    data[SOURCE_MACHINE_IP] = token_dict.get("terminal_ip")
    data[TARGET_USER_ID] = token_dict.get("uid")
    # TODO use other potentially interesting fields
    # aid, euid, egid, uid, gid, pid, session_id, terminal_port, terminal_ip
    return data
ParserManager.RegisterParser(BsmEventParser)

class SysLogParser():
  DATA_TYPE = "syslog:line"
  MATCH_REGEXP = re.compile(
    ".*Accepted password for (?P<user>\S+) "
    "from (?P<ip>(?:[0-9]{1,3}\.){3}[0-9]{1,3}) port (?P<port>(\d+)).*")
  #TODO do I care for fails?
  @classmethod
  def Parse(cls, event):
    "parsing the message field"
    match = cls.MATCH_REGEXP.match(event.get("message", ""))
    if not match:
      return {}

    data = {}
    data[TARGET_USER_NAME] = match.group("user")
    data[SOURCE_MACHINE_IP] = match.group("ip")
    #TODO do I care for port?
    return data
ParserManager.RegisterParser(SysLogParser)

class SysLogSshParser():
  """
  plaso is parsing this stuff, but I trust only the message field.
  Successful login of user: deanfrom 10.0.8.6:52673using authentication method: publickeyssh pid: 6844
  boby is slightly different:
  Accepted publickey for dean from 10.0.8.6 port 52673 ssh2: RSA a5:ed:32:56:6e:cb:be:88:70:1d:88:4f:9b:ce:bf:d1
  I am not sure about \s whitespaces
  """
  DATA_TYPE = "syslog:ssh:login"
  MATCH_REGEXP = re.compile (
    ".*Successful login of user: (?P<user>\S+)\s?from "
    "(?P<ip>(?:[0-9]{1,3}\.){3}[0-9]{1,3}):(?P<port>(\d+)).*")

  #TODO do i care for authentication method or pid?
  @classmethod
  def Parse(cls, event):
    data = {}
    match = cls.MATCH_REGEXP.match(event.get("message",""))
    if not match:
      return {}

    data[TARGET_USER_NAME] = match.group("user")
    data[SOURCE_MACHINE_IP] =  match.group("ip")
    return data
ParserManager.RegisterParser(SysLogSshParser)