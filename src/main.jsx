import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// 兜底：任何模块渲染抛错时显示可读错误，而不是整页白屏
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('页面渲染出错：', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 560, margin: '12vh auto', padding: '0 20px', color: '#2b2118' }}>
          <h2 style={{ fontSize: 18 }}>页面渲染出错</h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: '#6b5c4a' }}>
            该模块抛出了异常，已拦下避免白屏。把下面这行信息发给开发者即可定位。
          </p>
          <pre
            style={{
              background: '#f5efe4',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #c23a2b',
              background: '#c23a2b',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
