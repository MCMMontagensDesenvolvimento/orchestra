from bridge import BridgeConfig, BridgeConfigurationError, create_server


def main() -> None:
    try:
        config = BridgeConfig.from_env()
        server = create_server(config)
    except BridgeConfigurationError:
        raise SystemExit("Agno bridge configuration is invalid.") from None

    print("Agno bridge listening on its configured local endpoint.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

