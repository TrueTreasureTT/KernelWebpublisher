                         ┌────────────────────┐
                         │     User Browser    │
                         └─────────┬──────────┘
                                   │
                              HTTPS request
                                   │
                                   ▼
                       *.example.kernel.app
                                   │
                                   ▼
                         ┌──────────────────┐
                         │ Reverse Proxy /  │
                         │ CDN / Edge       │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          api.example.kernel.app       site deployment
                    │                           │
                    ▼                           ▼
             TypeScript API             Published files
                    │
                    ▼
                PostgreSQL
