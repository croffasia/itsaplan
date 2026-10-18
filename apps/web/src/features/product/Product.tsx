import ProductHeader from './components/ProductHeader';
import ProductHero from './components/ProductHero';
import ProductProblem from './components/ProductProblem';
import ProductDifferentiators from './components/ProductDifferentiators';
import ProductFeatures from './components/ProductFeatures';
import ProductArchitecture from './components/ProductArchitecture';
import ProductComparison from './components/ProductComparison';
import ProductTrust from './components/ProductTrust';
import ProductRoadmap from './components/ProductRoadmap';
import ProductCta from './components/ProductCta';
import ProductFooter from './components/ProductFooter';

export default function Product() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ProductHeader />
      <main id="main">
        <ProductHero />
        <ProductProblem />
        <ProductDifferentiators />
        <ProductFeatures />
        <ProductArchitecture />
        <ProductComparison />
        <ProductTrust />
        <ProductRoadmap />
        <ProductCta />
      </main>
      <ProductFooter />
    </div>
  );
}
