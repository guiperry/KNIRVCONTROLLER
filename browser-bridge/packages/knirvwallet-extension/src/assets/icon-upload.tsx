import React from 'react';

interface IconUploadProps {
  fill?: string;
}

const IconUpload: React.FC<IconUploadProps> = ({ fill = 'white' }): JSX.Element => (
  <svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'>
    <path
      className='icon'
      d='M16 5C13.6131 5 11.3239 5.89016 9.63604 7.47465C8.27822 8.74933 7.39907 10.3894 7.10719 12.1486C5.36937 12.4196 3.75151 13.1933 2.48959 14.378C0.895533 15.8744 0 17.9041 0 20.0204C0 22.1367 0.895533 24.1664 2.48959 25.6628C4.08365 27.1593 6.24566 28 8.5 28L23.5 28C25.7543 28 27.9163 27.1593 29.5104 25.6628C31.1045 24.1664 32 22.1367 32 20.0204C32 17.9041 31.1045 15.8744 29.5104 14.378C28.2485 13.1933 26.6306 12.4196 24.8928 12.1486C24.6009 10.3894 23.7218 8.74933 22.364 7.47465C20.6761 5.89016 18.3869 5 16 5Z'
      fill={fill}
    />
    <path d='M16 13L22.0622 19.75H9.93782L16 13Z' fill='#191920' />
    <rect x='14' y='19' width='4' height='5' fill='#191920' />
  </svg>

);

export default IconUpload;
