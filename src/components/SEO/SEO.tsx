import type { FC } from 'react';

type Props = {
    title: string;
    description: string;
    name: string;
    type: string;
}

const SEO: FC<Props> = ({ title, description, name, type }) => {
    
    return (
        <>
            { /* Standard metadata tags */}
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width" />
            <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            
            <title>{title}</title>
            <meta name='description' content={description} />
            { /* End standard metadata tags */}
            { /* Facebook tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            { /* End Facebook tags */}
            { /* Twitter tags */}
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:card" content={type} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            { /* End Twitter tags */}
        </>
    )
}

export { SEO }