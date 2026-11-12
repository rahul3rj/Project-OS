import React, { Component } from "react";

export class WidgetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[WidgetErrorBoundary] Error in "${this.props.name || "Widget"}":`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="figma-glass-static rounded-[26px] p-4 text-white font-gilroy-medium w-full h-full flex flex-col items-center justify-center text-center shadow-xl select-none">
          <div className="h-10 w-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 text-lg mb-2 shadow-inner">
            <i className="ri-error-warning-line" />
          </div>
          <h4 className="text-xs font-gilroy-bold text-white mb-1">
            {this.props.name ? `${this.props.name} Failed` : "Widget Error"}
          </h4>
          <p className="text-[11px] text-white/50 max-w-[200px] line-clamp-2 mb-3">
            {this.state.error?.message || "An unexpected error occurred while rendering this widget."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white font-gilroy-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <i className="ri-refresh-line text-xs" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
