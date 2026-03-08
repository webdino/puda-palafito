export function StatusBanner({
  isAvailable,
  errorDetails,
}: {
  isAvailable: boolean | null;
  errorDetails: string | null;
}) {
  if (isAvailable === null) {
    return <p>AI の利用可否を確認中...</p>;
  }

  if (isAvailable) {
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: "#d4edda",
          color: "#155724",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 18, marginTop: 0 }}>✅ Summarizer API は利用可能です</h2>
        <p style={{ margin: 0 }}>AI 機能は正常に動作しています。</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #f5c6cb",
        backgroundColor: "#f8d7da",
        color: "#721c24",
        borderRadius: 8,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 18, marginTop: 0 }}>❌ Summarizer API は利用できません</h2>
      {errorDetails && (
        <p style={{ fontSize: 14, fontFamily: "monospace", marginTop: 8, opacity: 0.8 }}>
          エラー: {errorDetails}
        </p>
      )}
    </div>
  );
}
