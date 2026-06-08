export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--c-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "3px solid var(--c-border)",
          borderTopColor: "#0066FF",
          animation: "forbion-spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes forbion-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
