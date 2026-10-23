const bannerBase = "/assets/under-construction/under-construction-banner-468x60";
const buttonBase = "/assets/under-construction/under-construction-button-88x31";

export function UcBanner() {
  return (
    <div className="uc-banner">
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={`${bannerBase}-static.png 1x, ${bannerBase}-static@2x.png 2x`}
        />
        <img
          src={`${bannerBase}.gif`}
          srcSet={`${bannerBase}.gif 1x, ${bannerBase}@2x.gif 2x`}
          width={468}
          height={60}
          alt="Under construction. Coming soon."
        />
      </picture>
    </div>
  );
}

export function UcButton() {
  return (
    <picture className="uc-btn">
      <source
        media="(prefers-reduced-motion: reduce)"
        srcSet={`${buttonBase}-static.png 1x, ${buttonBase}-static@2x.png 2x`}
      />
      <img
        src={`${buttonBase}.gif`}
        srcSet={`${buttonBase}.gif 1x, ${buttonBase}@2x.gif 2x`}
        width={88}
        height={31}
        alt="Coming soon: under construction"
      />
    </picture>
  );
}
