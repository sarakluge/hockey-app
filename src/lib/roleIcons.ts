import {
  AssignmentOutlined,
  MeetingRoomOutlined,
  DesktopWindowsOutlined,
  MicNone,
  TimerOutlined,
  PeopleOutlined,
} from "@mui/icons-material";

const roleIcons = {
  Båsdörr: MeetingRoomOutlined,
  "Båsdörr 1": MeetingRoomOutlined,
  "Båsdörr 2": MeetingRoomOutlined,
  OVR: DesktopWindowsOutlined,
  Klockan: TimerOutlined,
  Klocka: TimerOutlined,
  "Speaker/Musik": MicNone,
  Matchvärd: PeopleOutlined,
};

export function roleIcon(role: string) {
  return roleIcons[role as keyof typeof roleIcons] || AssignmentOutlined;
}
