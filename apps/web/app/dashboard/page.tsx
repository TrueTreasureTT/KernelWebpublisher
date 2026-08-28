"use client";

import { useEffect, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export default function Dashboard() {
  const [projects, setProjects] =
    useState<Project[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function loadProjects() {
    const token =
      localStorage.getItem("token");

    if (!token) return;

    const response =
      await fetch(`${API}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

    if (response.ok) {
      setProjects(
        await response.json()
      );
    }
  }

  async function createProject() {
    const token =
      localStorage.getItem("token");

    if (!token) {
      alert("Please log in first.");
      return;
    }

    const response =
      await fetch(`${API}/projects`, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          slug,
          source: `<!doctype html>
<html>
<head>
<title>${name}</title>
</head>
<body>
<h1>${name}</h1>
<p>Your website is live.</p>
</body>
</html>`
        })
      });

    if (!response.ok) {
      const data =
        await response.json();

      alert(data.error);
      return;
    }

    setName("");
    setSlug("");

    await loadProjects();
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 40,
        fontFamily: "system-ui"
      }}
    >
      <h1>Dashboard</h1>

      <section
        style={{
          marginTop: 30,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12
        }}
      >
        <h2>New website</h2>

        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          placeholder="Website name"
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            marginTop: 12
          }}
        />

        <input
          value={slug}
          onChange={(e) =>
            setSlug(e.target.value)
          }
          placeholder="website-slug"
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            marginTop: 12
          }}
        />

        <button
          onClick={createProject}
          style={{
            marginTop: 15,
            padding: "10px 18px"
          }}
        >
          Create Website
        </button>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Your websites</h2>

        {projects.map((project) => (
          <div
            key={project.id}
            style={{
              padding: 20,
              border:
                "1px solid #ddd",
              borderRadius: 12,
              marginTop: 12
            }}
          >
            <strong>
              {project.name}
            </strong>

            <div>
              {project.slug}
              .example.kernel.app
            </div>

            <small>
              Status: {project.status}
            </small>
          </div>
        ))}
      </section>
    </main>
  );
          }
