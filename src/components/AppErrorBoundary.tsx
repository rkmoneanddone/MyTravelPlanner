import React from "react";

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("MyTravelPlanner UI error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            maxWidth: 760,
            margin: "48px auto",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1>Something went wrong</h1>
          <p>
            Your browser could not display this page correctly. Reload the page and try again.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload MyTravelPlanner
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}