import type { FC } from 'react';

export type SeoProps = {
    title: string;
    description: string;
    name: string;
    type: string;
    image?: string;
}

const SEO: FC<SeoProps> = ({ title, description, name, image, type }) => {
    
    return (
        <>
            { /* Standard metadata tags */}
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width" />
            <link rel="icon" type="image/ico" href="./favicon.ico" />
            
            <title>{title}</title>
            <meta name='description' content={description} />
            { /* End standard metadata tags */}
            { /* Facebook tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title.length > 60 ? `${title.substring(0, 57)}...` : title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image ?? ""} />
            { /* End Facebook tags */}
            { /* Twitter tags */}
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:card" content={type} />
            <meta name="twitter:title" content={title.length > 70 ? `${title.substring(0, 67)}...` : title} />
            <meta name="twitter:description" content={description.length > 200 ? `${description.substring(0, 197)}...` : description} />
            <meta name="twitter:image" content={image ?? ""} />
            { /* End Twitter tags */}
        </>
    )
}

export { SEO }
