export class MeetingItemDto {
  meetingId: number;
  title: string;
  interestName: string;
  maxParticipants: number;
  currentParticipants: number;
  address: string;
  meetingDate: Date;
}

export class MyMeetingDto extends MeetingItemDto {
  status: string;
  isHost: boolean;
  isCompleted: boolean;
}
