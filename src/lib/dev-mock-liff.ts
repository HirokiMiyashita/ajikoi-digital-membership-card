type MockLiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

export function isDevMockLiffEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_MOCK_LIFF === "true"
  );
}

export function resolveDevMockUser(): MockLiffProfile {
  return {
    userId: "local-dev-user",
    displayName: "ローカル開発ユーザー",
  };
}
