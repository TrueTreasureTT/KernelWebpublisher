export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        fontFamily: "system-ui"
      }}
    >
      <h1>Kernel Publisher</h1>

      <p>
        Publish websites to your own cloud domain.
      </p>

      <a
        href="/dashboard"
        style={{
          marginTop: 24,
          padding: "12px 20px",
          borderRadius: 8,
          background: "black",
          color: "white",
          textDecoration: "none"
        }}
      >
        Open Dashboard
      </a>
    </main>
  );
}
