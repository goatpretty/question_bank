import { render, screen } from '@testing-library/react';
import MathRenderer from '../MathRenderer';

describe('MathRenderer', () => {
  it('renders simple text without math', () => {
    render(<MathRenderer content="This is a simple text" />);
    expect(screen.getByText('This is a simple text')).toBeInTheDocument();
  });

  it('renders inline math formula', () => {
    const { container } = render(<MathRenderer content="The equation is $x^2 + y^2 = z^2$ for triangles" />);
    expect(container.querySelector('.katex')).toBeInTheDocument();
  });

  it('renders block math formula', () => {
    const { container } = render(
      <MathRenderer content="The quadratic formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$" />
    );
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
  });

  it('renders mixed content with math and text', () => {
    const { container } = render(
      <MathRenderer content="Euler's identity $e^{i\\pi} + 1 = 0$ is considered beautiful. The area of a circle is $$A = \\pi r^2$$." />
    );
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
  });

  it('handles math rendering errors gracefully', () => {
    // 无效 LaTeX 由 KaTeX 标记为错误文本，而不是抛出异常
    const { container } = render(<MathRenderer content="Invalid math: $\\invalid{command}$" />);
    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.textContent).toContain('\\invalid');
  });

  it('escapes HTML in plain text', () => {
    const { container } = render(<MathRenderer content={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<MathRenderer content="Test content" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});