export class BaseMeetingDto {
  meetingId: number;
  title: string;
  interestName: string;
  maxParticipants: number;
  currentParticipants: number;
  address: string;
  meetingDate: Date;
}

export class MeetingItemDto extends BaseMeetingDto {
  meetingImage: string | null;
}

export class MyMeetingDto extends BaseMeetingDto {
  status: string;
  isHost: boolean;
  isCompleted: boolean;
}
