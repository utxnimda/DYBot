export interface AudioOutputDeviceInfo {
  readonly outputDeviceId: string;
  readonly label: string;
  readonly isDefault: boolean;
}

export function listMockAudioOutputDevices(): AudioOutputDeviceInfo[] {
  return [
    {
      outputDeviceId: "mock-default-output",
      label: "Mock default output",
      isDefault: true,
    },
  ];
}
