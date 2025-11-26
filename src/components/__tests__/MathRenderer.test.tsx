import { render, screen } from '@testing-library/react';
import MathRenderer from '../MathRenderer';

describe('MathRenderer', () => {
  it('renders simple text without math', () => {
    render(<MathRenderer content="This is a simple text" />);
    expect(screen.getByText('This is a simple text')).toBeInTheDocument();
  });

  it('renders inline math formula', () => {
    render(<MathRenderer content="The equation is $x^2 + y^2 = z^2$ for triangles" />);
    const container = screen.getByRole('math');
    expect(container).toBeInTheDocument();
  });

  it('renders block math formula', () => {
    render(<MathRenderer content="The quadratic formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$" />);
    const container = screen.getByRole('math');
    expect(container).toBeInTheDocument();
  });

  it('renders mixed content with math and text', () => {
    render(
      <MathRenderer content="Euler's identity $e^{i\\pi} + 1 = 0$ is considered beautiful. The area of a circle is $$A = \\pi r^2$$." />
    );
    const mathElements = screen.getAllByRole('math');
    expect(mathElements.length).toBeGreaterThan(0);
  });

  it('handles math rendering errors gracefully', () => {
    // Test with invalid LaTeX
    render(<MathRenderer content="Invalid math: $\\invalid{command}$" />);
    const container = screen.getByText(/公式错误/);
    expect(container).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MathRenderer content="Test content" className="custom-class" />);
    const element = screen.getByText('Test content');
    expect(element.parentElement).toHaveClass('custom-class');
  });
});